import {ApiError,db,emailField,hash,notify,textField} from "@/lib/server";
import {payoutName,type PayoutMethod,type PayoutRequest} from "@/lib/payout-types";
import type {Buyer} from "@/lib/catalog";

type PayoutRow={order_id:string;event_id:string;provider:PayoutMethod;recipient_email:string;code:string;status:"pending"|"sent"|"failed";claim_id:string;created_at:number;updated_at:number};
export async function readPayoutRequests(search=""):Promise<PayoutRequest[]>{
 const query=search.trim().slice(0,100),like="%"+query.replace(/[\\%_]/g,"\\$&")+"%";
 const rows=await db().prepare(`SELECT o.id,o.created_at,b.name,b.email AS buyer_email,b.phone AS buyer_phone,
 json_extract(o.details,'$.email') AS email,json_extract(o.details,'$.phone') AS phone,
 json_extract(o.details,'$.devisReference') AS devis_reference,json_extract(o.details,'$.maitreOuvrage') AS maitre_ouvrage,
 json_extract(o.details,'$.amount') AS amount,json_extract(o.details,'$.discount') AS discount,
 json_extract(o.details,'$.paymentMethod') AS payment_method,p.provider,p.status,p.code,p.updated_at,p.event_id
 FROM orders o JOIN buyers b ON b.id=o.buyer_id LEFT JOIN remise_payouts p ON p.order_id=o.id
 WHERE o.kind='remise' AND (?='' OR o.id LIKE ? ESCAPE '\\' OR b.email LIKE ? ESCAPE '\\' OR b.name LIKE ? ESCAPE '\\' OR json_extract(o.details,'$.email') LIKE ? ESCAPE '\\' OR json_extract(o.details,'$.devisReference') LIKE ? ESCAPE '\\') ORDER BY o.created_at DESC LIMIT 100`).bind(query,like,like,like,like,like).all<Record<string,unknown>>();
 return rows.results.map(r=>({orderId:String(r.id),createdAt:Number(r.created_at),name:String(r.name),email:String(r.email||r.buyer_email),phone:String(r.phone||r.buyer_phone),devisReference:String(r.devis_reference||""),maitreOuvrage:String(r.maitre_ouvrage||""),amount:Number(r.amount||0),discount:Number(r.discount||0),method:(["cashplus","wafacash"].includes(String(r.payment_method||r.provider))?String(r.payment_method||r.provider):null) as PayoutMethod|null,status:(r.status||"awaiting_transfer") as PayoutRequest["status"],code:typeof r.code==="string"?r.code:undefined,sentAt:r.status==="sent"?Number(r.updated_at):undefined,updatedAt:r.updated_at?Number(r.updated_at):undefined,eventId:typeof r.event_id==="string"?r.event_id:undefined}));
}
export async function sendPayoutCode(body:Record<string,unknown>){
 const orderId=textField(body.orderId,"La référence de demande",100);
 const record=await db().prepare("SELECT o.details,o.total_cents,b.id,b.name,b.phone,b.email,b.maitre_ouvrage,b.city FROM orders o JOIN buyers b ON b.id=o.buyer_id WHERE o.id=? AND o.kind='remise'").bind(orderId).first<{details:string;total_cents:number;id:string;name:string;phone:string;email:string;maitre_ouvrage:string|null;city:string|null}>();
 if(!record)throw new ApiError("Demande de remise introuvable.",404);
 const details=JSON.parse(record.details) as Record<string,unknown>;
 if(!(Number(details.discount)>0))throw new ApiError("Cette demande ne contient aucun montant de remise à verser.");
 const method=body.provider;
 if(method!=="cashplus"&&method!=="wafacash")throw new ApiError("Choisissez Cash Plus ou Wafacash.");
 if(details.paymentMethod&&method!==details.paymentMethod)throw new ApiError("Utilisez le service choisi par le client.");
 const email=emailField(body.email);
 if(email!==String(details.email||record.email).trim().toLowerCase())throw new ApiError("L’email doit correspondre au bénéficiaire indiqué dans cette demande.");
 const code=textField(body.code,"Le code ou numéro de transfert",80);
 if(!/^[A-Za-z0-9][A-Za-z0-9 ./-]{3,79}$/.test(code))throw new ApiError("Saisissez le code de transfert sans saut de ligne.");
 if(body.confirmedTransfer!==true)throw new ApiError("Confirmez que le transfert a été effectué avant d’envoyer son code.");
 const now=Date.now(),claimId=crypto.randomUUID();
 const eventId="TZ-R-"+(await hash("payout:"+orderId+":"+method+":"+email+":"+code)).slice(0,12).toUpperCase();
 await db().prepare("INSERT OR IGNORE INTO remise_payouts (order_id,event_id,provider,recipient_email,code,status,claim_id,created_at,updated_at) VALUES (?,?,?,?,?,'pending',?,?,?)").bind(orderId,eventId,method,email,code,claimId,now,now).run();
 let payout=await db().prepare("SELECT * FROM remise_payouts WHERE order_id=?").bind(orderId).first<PayoutRow>();
 if(!payout)throw new Error("Payout unavailable");
 if(payout.event_id!==eventId)throw new ApiError("Un autre code a déjà été enregistré pour cette demande. Vérifiez l’historique avant toute modification.",409);
 if(payout.status==="sent")return {status:"sent",duplicate:true,orderId};
 if(payout.claim_id!==claimId){
  if(payout.status==="pending"&&now-payout.updated_at<120000)throw new ApiError("L’envoi de ce code est déjà en cours. Actualisez dans un instant.",409);
  const claimed=await db().prepare("UPDATE remise_payouts SET status='pending',claim_id=?,updated_at=? WHERE order_id=? AND claim_id=? AND status=? AND updated_at=?").bind(claimId,now,orderId,payout.claim_id,payout.status,payout.updated_at).run();
  if(!claimed.meta.changes)throw new ApiError("Ce code est déjà en cours d’envoi.",409);
 }
 const buyer:Buyer={id:record.id,name:record.name,phone:record.phone,email:record.email,maitreOuvrage:record.maitre_ouvrage,city:record.city};
 // A distinct, deterministic event ID preserves Gmail v2 and Resend deduplication,
 // while the original request and its notification history remain untouched.
 const delivery=await notify(eventId,buyer,"remise",{...details,email,payout:{orderId,provider:method,providerName:payoutName(method),code,amount:Number(details.discount)}},record.total_cents/100,now,false);
 const status=delivery.customer==="sent"?"sent":"failed";
 await db().prepare("UPDATE remise_payouts SET status=?,company_status=?,last_error=?,updated_at=? WHERE order_id=? AND claim_id=?").bind(status,delivery.company,status==="sent"?null:"Email delivery not confirmed",Date.now(),orderId,claimId).run();
 return {status,orderId,customerNotification:delivery.customer,companyNotification:delivery.company};
}
