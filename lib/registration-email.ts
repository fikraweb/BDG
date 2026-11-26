import { config, hash } from "@/lib/server";
import { procurementLabel } from "@/lib/procurement";
import type { Buyer } from "@/lib/catalog";

// Only called after the account transaction succeeds. Passwords and session
// credentials never enter this message or its signed payload.
export async function notifyRegistration(buyer: Buyer) {
  const id = "TZ-I-" + (await hash("registration:" + buyer.id)).slice(0,12).toUpperCase();
  const to = config("NOTIFICATION_EMAIL_REMISE"), url = config("GMAIL_RELAY_URL"), secret = config("GMAIL_RELAY_SECRET");
  const body = ["Une nouvelle inscription a été enregistrée sur le site BDG.", "", "Nom et prénom : " + buyer.name, "Maître d’ouvrage : " + (buyer.maitreOuvrage || ""), "Téléphone : " + buyer.phone, "Email : " + buyer.email, "Ville : " + (buyer.city || ""), "Cadre d’achat : " + procurementLabel(buyer.procurementType), "", "Service administratif · Société TAWZALA SARL"].join("\n");
  try {
    if (!to) throw new Error("not_configured");
    if (url) {
      if (!secret || !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,200}\/exec$/.test(url)) throw new Error("not_configured");
      const payload = JSON.stringify({ kind:"registration", orderId:id, to, replyTo:buyer.email, subject:"BDG · Nouvelle inscription · " + id, body });
      const timestamp = Date.now(), key = await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
      const signature = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(timestamp+"."+payload))),v=>v.toString(16).padStart(2,"0")).join("");
      const signal = AbortSignal.timeout(15000);
      let response = await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({version:1,timestamp,payload,signature}),redirect:"manual",signal});
      if ([301,302,303].includes(response.status)) {
        const target = new URL(response.headers.get("location") || "");
        if (target.protocol !== "https:" || target.hostname !== "script.googleusercontent.com" || target.pathname !== "/macros/echo" || target.username || target.password || target.port) throw new Error("provider_unavailable");
        response = await fetch(target.href,{redirect:"manual",signal});
      }
      const result = await response.json() as {ok?:boolean;id?:string};
      if (!response.ok || result.ok !== true || result.id !== "gmail:"+id) throw new Error("not_confirmed");
    } else {
      const key=config("RESEND_API_KEY"),from=config("EMAIL_FROM");
      if (!key || !from) throw new Error("not_configured");
      const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json","Idempotency-Key":"bdg/"+id},body:JSON.stringify({from,to:[to],reply_to:buyer.email,subject:"BDG · Nouvelle inscription · "+id,text:body}),signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error("not_confirmed");
    }
    return "sent";
  } catch { console.warn("TAWZALA registration notification not confirmed",{id}); return "failed"; }
}
