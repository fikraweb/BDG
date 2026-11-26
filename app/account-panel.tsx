"use client";
import {useEffect,useState,type FormEvent} from "react";
import {CheckCircle2,Loader2,LockKeyhole,UserRound} from "lucide-react";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {procurementLabel} from "@/lib/procurement";
import type {Buyer} from "@/lib/catalog";

export default function AccountPanel({open,onOpenChange,buyer,onChangePassword}:{open:boolean;onOpenChange:(open:boolean)=>void;buyer:Buyer;onChangePassword:(values:Record<string,unknown>)=>Promise<void>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState(false);
 const [current,setCurrent]=useState(""),[password,setPassword]=useState(""),[confirmation,setConfirmation]=useState("");
 useEffect(()=>{if(!open){setCurrent("");setPassword("");setConfirmation("");setError("");setSuccess(false);}},[open]);
 async function change(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;setBusy(true);setError("");setSuccess(false);
  try{await onChangePassword({currentPassword:current,password,confirmPassword:confirmation});setCurrent("");setPassword("");setConfirmation("");setSuccess(true);}
  catch(err){setError((err as Error).message||"Impossible de modifier votre mot de passe. Réessayez.");}
  finally{setBusy(false);}
 }
 return <Dialog open={open} onOpenChange={value=>{if(!busy)onOpenChange(value);}}><DialogContent className="account-dialog"><DialogTitle><UserRound size={21}/>Mon compte</DialogTitle><DialogDescription>Vos coordonnées et votre mot de passe de connexion.</DialogDescription><dl className="account-details"><div><dt>Nom complet</dt><dd>{buyer.name}</dd></div><div><dt>Email de connexion</dt><dd>{buyer.email}</dd></div><div><dt>Téléphone</dt><dd>{buyer.phone}</dd></div><div><dt>Maître d’ouvrage</dt><dd>{buyer.maitreOuvrage||"Non renseigné"}</dd></div><div><dt>Cadre d’achat</dt><dd>{procurementLabel(buyer.procurementType)}</dd></div><div className="account-city"><dt>Ville</dt><dd>{buyer.city||"Non renseignée"}</dd></div></dl><form onSubmit={change} className="account-password-form"><h2><LockKeyhole size={19}/>Changer mon mot de passe</h2><fieldset disabled={busy}><label className="field">Mot de passe actuel<input type="password" required maxLength={128} autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)}/></label><label className="field">Nouveau mot de passe<input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/><small>8 caractères minimum.</small></label><label className="field">Confirmer le nouveau mot de passe<input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label></fieldset>{error&&<p className="form-error" role="alert">{error}</p>}{success&&<p className="account-success" role="status"><CheckCircle2 size={18}/>Votre mot de passe a été modifié.</p>}<button className="primary-button" disabled={busy}>{busy?<Loader2 size={18} className="spin"/>:<LockKeyhole size={18}/>}Enregistrer mon mot de passe</button></form></DialogContent></Dialog>;
}
