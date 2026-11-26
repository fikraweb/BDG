"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import BuyerService from "@/app/buyer-service";
import { extraServices, isExtraService } from "@/lib/buyer-services";
import RemiseTicker from "@/app/remise-ticker";
import FurniturePreview from "@/app/furniture-preview";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { LockKeyhole, Eye, EyeOff, ShieldCheck, LogOut, Calculator, Clock, CheckCircle2, ChevronRight, Building2, UserRound, Mail, Phone, Loader2, Menu, Download, BadgePercent, Pause, Play } from "lucide-react";
import { initializeClientVisit, endClientVisit, finishClientPage, isInternalVisitExit, prepareAdminVisit, forgetClientContinuation } from "@/lib/client-visit";
import { DOCUMENT_TYPES, isDocumentKind, type DocumentKind } from "@/lib/document-types";
import DocumentRequests from "@/app/document-requests";
import CityField from "@/app/city-field";
import AccountPanel from "@/app/account-panel";
import {RadioGroup,RadioGroupItem} from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { PROCUREMENT_OPTIONS } from "@/lib/procurement";
import { calculateRemise, money, type PriceQuote, type Buyer } from "@/lib/catalog";
import type { SiteSettings, SiteStore } from "@/lib/site-types";
import { BRAND_NAME } from "@/lib/company";

type ApiReply = { error?: string; next: string; buyer: Buyer | null; authenticated: boolean; hasAccount: boolean; orderId: string; total?: number; summary?: PriceQuote; pdfUrl?: string; notification?: string; customerNotification?: string; store?: SiteStore; isAdmin?: boolean };
const navigation = [
 ["remise", "Remise d’achat"],
 ["imported", "Mobilier de bureaux importation haut de gamme"],
 ["moroccan", "Mobilier de bureaux marocain"],
 ["facture", "Demande de facture"],
 ["livraison", "Demande de bon de livraison"],
 ["echantillons", "Demande de bon de livraison des échantillons"],
 ...Object.entries(extraServices),
];
const serviceIcons: Record<string, string> = {
 remise: "remise-mark",
 imported: "imported",
 moroccan: "moroccan-chair",
 facture: "facture-mark",
 livraison: "livraison-mark",
 echantillons: "echantillons-mark",
 caution: "caution",
 references: "references",
 reglementation: "reglementation",
 echanges: "echanges",
 autres: "autres",
};
function ServiceIcon({id,size=40}:{id:string;size?:number}) {
 const icon = serviceIcons[id] ?? serviceIcons.facture;
 return <img className="service-asset-icon" src={`/images/service-${icon}.webp`} width={size} height={size} alt="" aria-hidden="true" style={{width:size,height:size}}/>;
}
const paths: Record<string,string> = {access:"/",register:"/inscription",hub:"/marches-publics",remise:"/remise",requests:"/demandes",facture:"/demandes?type=facture",livraison:"/demandes?type=livraison",echantillons:"/demandes?type=echantillons",imported:"/catalogue/bureau",moroccan:"/catalogue/maroc",...Object.fromEntries(Object.keys(extraServices).map(id=>[id,`/services/${id}`]))};
async function api(action:string,data:Record<string,unknown>={}) {await initializeClientVisit();const r=await fetch("/api/tawzala",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...data})});const result=await r.json() as ApiReply;if(!r.ok)throw Object.assign(new Error(result.error||"La demande n’a pas pu être enregistrée."),{status:r.status});return result;}
function Brand({name=BRAND_NAME}:{name?:string}) {
 return <span className="brand"><img className="brand-logo" src="/images/bdg-logo.webp" width={32} height={32} alt=""/><span className="brand-word">{name}</span></span>;
}
function AccessStrip({label, paused, children, onToggle, flags=false}:{label:string;paused:boolean;children?:React.ReactNode;onToggle?:()=>void;flags?:boolean}) {
 return <div className={flags?"access-strip access-flag-strip":"access-strip"} data-paused={paused}>
  <span className="sr-only">{label}</span>
  <div className="access-strip-track" aria-hidden="true">
   {[0, 1].map(group=><div className="access-strip-group" key={group}>
    {[0, 1, 2].map(item=><span className="access-strip-item" key={item}>{children}</span>)}
   </div>)}
  </div>
  {onToggle&&<button type="button" className="access-strip-pause" onClick={onToggle} aria-label={paused?"Reprendre le défilement des bandeaux":"Mettre les bandeaux en pause"}>{paused?<Play size={17}/>:<Pause size={17}/>}</button>}
 </div>;
}
function Field({label,icon,children}:{label:string;icon?:React.ReactNode;children:React.ReactNode}) {return <label className="field"><span>{label}</span><span className="input-wrap">{icon&&<span className="input-icon">{icon}</span>}{children}</span></label>;}
function ProcurementField({buyer}:{buyer:Buyer|null}) {
 return <Field label="Cadre d’achat"><select className="procurement-select" name="procurementType" required defaultValue={buyer?.procurementType||""}><option value="" disabled>Choisissez votre cadre d’achat</option>{Object.entries(PROCUREMENT_OPTIONS).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></Field>;
}
function RequestFields({buyer,compact=false,delivery=false,onCityChange}:{buyer:Buyer|null;compact?:boolean;delivery?:boolean;onCityChange?:()=>void}) {
 return <div className={`request-fields${compact?" request-fields-compact":""}`}><ProcurementField buyer={buyer}/>
  <Field label="Maître d’ouvrage" icon={<Building2 size={18}/>}><input name="maitreOuvrage" required maxLength={200} defaultValue={buyer?.maitreOuvrage||""} placeholder="Votre organisme ou administration"/></Field>
  <Field label="N° / référence du devis"><input name="devisReference" required maxLength={100} placeholder="Ex. : 5/2026"/></Field>
  <label className="field request-object">Objet de la prestation<textarea name="objet" required rows={3} maxLength={1000} placeholder="Ex. : Achat ou fourniture de mobilier de bureaux"/></label>
  <div className="request-contact-row">
   <Field label="Téléphone" icon={<Phone size={18}/>}><input name="phone" type="tel" required maxLength={30} defaultValue={buyer?.phone||""} autoComplete="tel"/></Field>
   <Field label="Email de contact" icon={<Mail size={18}/>}><input name="email" type="email" required maxLength={254} defaultValue={buyer?.email||""} autoComplete="email" placeholder="votreemail@gmail.com"/></Field>
  </div>
  <CityField name="clientCity" defaultValue={buyer?.city||""} className="request-object" onValueChange={onCityChange}/>
  {delivery&&<><CityField name="deliveryCity" label="Ville de livraison" defaultValue={buyer?.city||""} onValueChange={onCityChange}/><Field label="Délai / date souhaité (facultatif)"><input name="deliveryDeadline" maxLength={120} placeholder="Ex. : 5 jours, ou une date"/></Field></>}
 </div>;
}

function PriceBreakdown({quote,compact=false}:{quote:PriceQuote|null;compact?:boolean}) {
 return <div className={`price-breakdown${compact?" compact":""}`} aria-live="polite" aria-atomic="true">
  <div className="quote-final"><span>Remise d’achat</span><strong>{money(quote?.discount||0)}</strong><small>{quote?.rate??0} % de votre montant</small></div>
  <dl><div><dt>Montant total du devis TTC</dt><dd>{money(quote?.amount||0)}</dd></div><div><dt>Prix après remise</dt><dd>{money(quote?.net||0)}</dd></div></dl>
 </div>;
}

export default function Portal({initialScreen,initialAccountMode="signup",initialSettings,initialDocumentKind=null}:{initialDocumentKind?:DocumentKind|null;initialScreen:string;initialAccountMode?:"signup"|"signin";initialSettings:SiteSettings}) {
 const [accountOpen,setAccountOpen]=useState(false),[documentKind,setDocumentKind]=useState<DocumentKind|null>(initialDocumentKind);
 const [store,setStore]=useState<SiteStore>({settings:initialSettings,products:[]});
 const remiseRate=store.settings.remiseRate, brandName=BRAND_NAME;
 const router=useRouter(); const [screen,setScreen]=useState(initialScreen),[buyer,setBuyer]=useState<Buyer|null>(null),[authenticated,setAuthenticated]=useState(false),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [receipt,setReceipt]=useState<{orderId:string;total?:number;discount?:number;pdfUrl?:string;customerNotification?:string}|null>(null);
 const [passwordVisible,setPasswordVisible]=useState(false),[menuOpen,setMenuOpen]=useState(false);
 const [amount,setAmount]=useState("0");
 const [hasAccount,setHasAccount]=useState(false),[accountMode,setAccountMode]=useState<"signup"|"signin">(initialAccountMode),[accountPasswordVisible,setAccountPasswordVisible]=useState(false);
 const [paymentMethod,setPaymentMethod]=useState("");
 const authEpoch=useRef(0),submissionKey=useRef<string|null>(null);
 const calculation=useMemo(()=>{const value=Number(amount.replace(",","."));if(!amount.trim()||value===0)return {amount:0,rate:remiseRate,discount:0,net:0};try{return calculateRemise(value,remiseRate);}catch{return null;}},[amount,remiseRate]);
 function go(next:string,entry?:"signup"|"signin"){if(next==="imported"||next==="moroccan"){setMenuOpen(false);router.push(paths[next]+"?depuis=services");return;}if(isDocumentKind(next))setDocumentKind(next);else if(next==="requests")setDocumentKind(null);setScreen(isDocumentKind(next)?"requests":next);setError("");setMenuOpen(false);if(next==="remise")submissionKey.current=null;if(entry)setAccountMode(entry);router.push(paths[next]+(next==="register"&&entry==="signin"?"?mode=connexion":""));window.scrollTo({top:0,behavior:"instant"});}
 useEffect(()=>{setDocumentKind(initialDocumentKind);},[initialDocumentKind]);
 useEffect(()=>{setScreen(initialScreen);setError("");window.scrollTo({top:0,behavior:"instant"});},[initialScreen]);
 useEffect(()=>{if(initialScreen==="register"){setAccountMode(initialAccountMode);setAccountPasswordVisible(false);}},[initialScreen,initialAccountMode]);
 useEffect(()=>{let active=true;const epoch=authEpoch.current;initializeClientVisit().then(()=>fetch("/api/tawzala",{cache:"no-store"})).then(async r=>{const d=await r.json() as ApiReply;if(!r.ok)throw new Error(d.error);if(active&&epoch===authEpoch.current){if(d.store)setStore(d.store);setBuyer(d.buyer);setHasAccount(!!d.hasAccount);setAuthenticated(d.authenticated);setReady(true);}}).catch(e=>{if(active&&epoch===authEpoch.current){setReady(true);setError(e.message||"Impossible de charger votre espace.");}});return()=>{active=false;}},[initialScreen]);
 useEffect(()=>{if(!ready||screen==="access")return;if(!authenticated){router.replace("/");setScreen("access");}else if(!buyer&&screen!=="register"){setAccountMode("signin");router.replace("/inscription?mode=connexion");setScreen("register");}else if(buyer&&!hasAccount&&screen!=="register"){router.replace("/inscription");setScreen("register");}else if(buyer&&hasAccount&&screen==="register"){router.replace("/marches-publics");setScreen("hub");}},[ready,authenticated,buyer,hasAccount,screen,router]);
 useEffect(()=>{document.title=brandName+" | Acheteur public";},[brandName]);
 useEffect(()=>{const c=(document as unknown as {modelContext?:{registerTool:(tool:unknown,options:{signal:AbortSignal})=>Promise<void>|void}}).modelContext;if(!c?.registerTool||screen!=="remise")return;const life=new AbortController();Promise.resolve(c.registerTool({name:"calculate_bdg_remise",title:"Calculer une remise",description:"Calcule une remise et met à jour le calcul affiché. N’envoie aucune demande.",inputSchema:{type:"object",properties:{amount:{type:"number",exclusiveMinimum:0,maximum:1e10}},required:["amount"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async(input:unknown)=>{const d=input as {amount:number};if(typeof d.amount!=="number")throw new Error("Montant numérique obligatoire.");const result=calculateRemise(d.amount,remiseRate);setAmount(String(d.amount));submissionKey.current=null;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return result;}},{signal:life.signal})).catch(()=>{});return()=>life.abort();},[screen,remiseRate]);
 function clearPrivateSpace(){authEpoch.current++;setReady(true);setBusy(false);setBuyer(null);setAuthenticated(false);setHasAccount(false);setAccountOpen(false);setMenuOpen(false);setReceipt(null);setAmount("0");setPaymentMethod("");setPasswordVisible(false);setAccountPasswordVisible(false);submissionKey.current=null;setStore(value=>({...value,products:[]}));setScreen("access");setError("");}
 useEffect(()=>{
  function leave(){if(isInternalVisitExit())return;flushSync(clearPrivateSpace);finishClientPage();}
  function restore(event:PageTransitionEvent){if(event.persisted){flushSync(()=>{clearPrivateSpace();setReady(false);});router.replace("/");void endClientVisit().then(()=>initializeClientVisit()).then(()=>setReady(true)).catch(error=>{setReady(true);setError((error as Error).message);});}}
  window.addEventListener("pagehide",leave);window.addEventListener("pageshow",restore);
  return()=>{window.removeEventListener("pagehide",leave);window.removeEventListener("pageshow",restore);};
 },[]);
 async function login(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!ready||busy)return;const epoch=++authEpoch.current;setBusy(true);setError("");try{const d=await api("login",{password:new FormData(e.currentTarget).get("password")});if(epoch!==authEpoch.current)return;setAuthenticated(true);if(d.store)setStore(d.store);setBuyer(d.buyer);setHasAccount(!!d.hasAccount);go("register","signin");}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function register(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!ready||busy)return;const epoch=++authEpoch.current;setBusy(true);setError("");try{const d=await api("register",Object.fromEntries(new FormData(e.currentTarget)));if(epoch!==authEpoch.current)return;if(d.store)setStore(d.store);setBuyer(d.buyer);setHasAccount(!!d.hasAccount);go("hub");}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function signIn(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!ready||busy)return;const epoch=++authEpoch.current;setBusy(true);setError("");try{const d=await api("account-login",Object.fromEntries(new FormData(e.currentTarget)));if(epoch!==authEpoch.current)return;if(d.store)setStore(d.store);setBuyer(d.buyer);setHasAccount(!!d.hasAccount);go("hub");}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function logout(){authEpoch.current++;setBusy(true);try{await api("logout");forgetClientContinuation();setStore(value=>({...value,products:[]}));setBuyer(null);setHasAccount(false);setAccountOpen(false);setAuthenticated(false);setAmount("0");setReceipt(null);setAccountPasswordVisible(false);submissionKey.current=null;go("access");}catch(e){toast.error((e as Error).message);}finally{setBusy(false);}}
 async function leaveAccess(){authEpoch.current++;setBusy(true);try{await api("logout");forgetClientContinuation();setStore(value=>({...value,products:[]}));setBuyer(null);setHasAccount(false);setAccountOpen(false);setAccountMode("signup");setAuthenticated(false);setAmount("0");setReceipt(null);go("access");}catch(e){toast.error((e as Error).message);}finally{setBusy(false);}}
 function key(){return submissionKey.current??(submissionKey.current=crypto.randomUUID());}
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  const quote=calculation;
  if(busy||!quote||quote.amount<=0)return;
  const epoch=authEpoch.current;
  setBusy(true);setError("");
  try{
   const values=Object.fromEntries(new FormData(e.currentTarget));
   const d=await api("remise",{...values,amount:quote.amount,paymentMethod,expectedQuote:quote,idempotencyKey:key()});
   if(epoch!==authEpoch.current)return;
   setReceipt({orderId:d.orderId,total:d.total??d.summary?.net,discount:d.summary?.discount,pdfUrl:d.pdfUrl,customerNotification:d.customerNotification});
   if(d.buyer)setBuyer(d.buyer);
   submissionKey.current=null;
  }catch(e){
   if(epoch!==authEpoch.current)return;
   if((e as Error & {status?:number}).status===409){
    try{
     const r=await fetch("/api/tawzala",{cache:"no-store"});
     const d=await r.json() as ApiReply;
     if(epoch===authEpoch.current&&r.ok&&d.store){setStore(d.store);submissionKey.current=null;}
    }catch{}
   }
   if(epoch===authEpoch.current)setError((e as Error).message);
  }finally{if(epoch===authEpoch.current)setBusy(false);}
 }
 const [welcomePaused,setWelcomePaused]=useState(false);
 const access=screen==="access"||screen==="register";

 return <><TooltipProvider delayDuration={180}><Toaster position="top-center" theme="light"/><header className={`site-header${access?" access-header access-header-emblem":screen==="hub"?" hub-header":""}`}>{access?<>
  <AccessStrip label="Drapeau du Maroc" paused={welcomePaused} flags/>
  <AccessStrip label={brandName} paused={welcomePaused}><Brand name={brandName}/></AccessStrip>
 </>:<><nav className="desktop-nav" aria-label="Navigation principale">{navigation.map(([id,label])=><Tooltip key={id}><TooltipTrigger asChild><button className={(screen==="requests"?documentKind:screen)===id?"active":""} aria-label={label} aria-current={(screen==="requests"?documentKind:screen)===id?"page":undefined} onClick={event=>{
   if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
    event.currentTarget.animate?.([{transform:"scale(.9)"},{transform:"translateY(-3px) scale(1.1)"},{transform:"none"}],{duration:260,easing:"ease-out"});
   }
   go(id);
  }}><ServiceIcon id={id}/></button></TooltipTrigger><TooltipContent side="bottom" sideOffset={10}>{label}</TooltipContent></Tooltip>)}</nav><div className="header-actions"><button className="user-name account-trigger" onClick={()=>setAccountOpen(true)} disabled={!buyer||!hasAccount} aria-label="Ouvrir mon compte"><UserRound size={16}/><span>{buyer?.name.split(" ")[0]}</span></button><button className="icon-button logout-desktop" aria-label="Se déconnecter" onClick={logout} disabled={busy}><LogOut size={19}/></button><button className="icon-button mobile-toggle" aria-label="Ouvrir le menu" onClick={()=>setMenuOpen(true)}><Menu size={23}/></button><button className="brand-link" onClick={()=>go(authenticated&&buyer?"hub":"access")} aria-label={brandName+" — Accueil"}><Brand name={brandName}/></button></div></>}</header>
 {access?<main className={`access-layout access-blue access-emblem ${screen==="access"?"access-minimal":`access-registration access-registration-${accountMode}`}`}>
  {screen==="access"&&<FurniturePreview/>}
  <section className="access-form-panel"><div className="access-card">
   {screen==="register"&&<>
    <h1>{accountMode==="signin"?"Connexion":buyer?"Activer mon compte":"Inscription"}</h1>
    <p className="lead">{accountMode==="signin"?"Retrouvez votre compte avec votre email et votre mot de passe.":buyer?"Vos coordonnées sont enregistrées. Choisissez votre mot de passe pour vos prochaines visites.":"Créez votre compte pour accéder aux services BDG."}</p>
   </>}
   {screen==="access"?<>
    <div className="access-card-title">
     <h1>Royaume du Maroc</h1>
    </div>
    <form className="access-form" onSubmit={login}>
    <p className="access-form-caption">Connexion sécurisée</p>
    <Field label="Mot de passe d’accès" icon={<LockKeyhole size={19}/>}>
     <input name="password" type={passwordVisible?"text":"password"} required maxLength={128} placeholder="Votre mot de passe" autoComplete="current-password"/>
     <button type="button" className="show-password" aria-label={passwordVisible?"Masquer le mot de passe":"Afficher le mot de passe"} onClick={()=>setPasswordVisible(!passwordVisible)}>{passwordVisible?<EyeOff size={19}/>:<Eye size={19}/>}</button>
    </Field>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <button className="primary-button" disabled={busy||!ready}>{busy?<Loader2 className="spin" size={19}/>:<LockKeyhole size={17}/>}Entrer</button>
   </form>

   </>:<div className="account-entry">
 <Tabs value={accountMode} onValueChange={value=>{setAccountMode(value as "signup"|"signin");setError("");setAccountPasswordVisible(false);window.history.replaceState(null,"",value==="signin"?"/inscription?mode=connexion":"/inscription");}}>
  <TabsList className="account-tabs" aria-label="Inscription ou connexion">
   <TabsTrigger value="signup" disabled={busy}>{buyer?"Activer mon compte":"Créer un compte"}</TabsTrigger>
   <TabsTrigger value="signin" disabled={busy}>Se connecter</TabsTrigger>
  </TabsList>
 </Tabs>
 <form key={accountMode} className="access-form registration-form" onSubmit={accountMode==="signin"?signIn:register}>
  {accountMode==="signup"&&!buyer&&<div className="account-field-row">
   <Field label="Nom et prénom" icon={<UserRound size={18}/>}><input name="name" required maxLength={100} autoComplete="name" placeholder="Votre nom complet"/></Field>
   <Field label="Téléphone" icon={<Phone size={18}/>}><input name="phone" type="tel" required maxLength={30} autoComplete="tel" placeholder="06 00 00 00 00"/></Field>
  </div>}
  {accountMode==="signup"&&buyer&&<div className="account-profile"><UserRound size={18}/><span><strong>{buyer.name}</strong><small>{buyer.phone}</small></span></div>}
  <div className={accountMode==="signup"?"account-field-row":undefined}>
  <Field label="Adresse email" icon={<Mail size={18}/>}><input name="email" type="email" required maxLength={254} autoComplete={accountMode==="signin"?"username":"email"} placeholder="vous@organisme.ma" defaultValue={buyer?.email||""} readOnly={accountMode==="signup"&&!!buyer}/></Field>
  {accountMode==="signup"&&<Field label="Maître d’ouvrage" icon={<Building2 size={18}/>}><input name="maitreOuvrage" required maxLength={200} defaultValue={buyer?.maitreOuvrage||""} placeholder="Votre organisme ou administration"/></Field>}
  </div>
  {accountMode==="signup"&&<ProcurementField buyer={buyer}/>}
  {accountMode==="signup"&&<CityField defaultValue={buyer?.city||""}/>}
  <div className={accountMode==="signup"?"account-field-row":undefined}>
  <Field label={accountMode==="signin"?"Mot de passe du compte":"Choisir un mot de passe"} icon={<LockKeyhole size={18}/>}>
   <input name="password" type={accountPasswordVisible?"text":"password"} required minLength={accountMode==="signup"?8:undefined} maxLength={128} autoComplete={accountMode==="signup"?"new-password":"current-password"} placeholder={accountMode==="signup"?"Au moins 8 caractères":"Votre mot de passe personnel"} aria-describedby={accountMode==="signup"?"account-password-help":undefined}/>
   <button type="button" className="show-password" aria-label={accountPasswordVisible?"Masquer le mot de passe":"Afficher le mot de passe"} onClick={()=>setAccountPasswordVisible(!accountPasswordVisible)}>{accountPasswordVisible?<EyeOff size={19}/>:<Eye size={19}/>}</button>
  </Field>
  {accountMode==="signup"&&<Field label="Confirmer le mot de passe" icon={<LockKeyhole size={18}/>}><input name="confirmPassword" type={accountPasswordVisible?"text":"password"} required minLength={8} maxLength={128} autoComplete="new-password" placeholder="Saisissez-le une seconde fois"/></Field>}
  </div>
  {accountMode==="signup"&&<>
   <p id="account-password-help" className="field-note">Au moins 8 caractères. Vous utiliserez ce mot de passe pour vous reconnecter.</p>
   <p className="data-note">Ces coordonnées permettent à BDG de traiter vos demandes et de vous recontacter.</p>
  </>}
  {accountMode==="signin"&&<p className="data-note">Inscrit auparavant sans mot de passe ? Activez votre compte depuis votre session existante, ou créez un compte avec un mot de passe.</p>}
  {error&&<p className="form-error" role="alert">{error}</p>}
  <button className="primary-button" disabled={busy||!ready}>{busy?<Loader2 size={18} className="spin"/>:<LockKeyhole size={17}/>} {accountMode==="signin"?"Se connecter":buyer?"Enregistrer mon mot de passe":"S’inscrire et continuer"}</button>
  <button type="button" className="text-button" onClick={leaveAccess} disabled={busy}>Revenir à l’accès</button>
 </form>
</div>}</div>{screen==="register"&&<div className="access-copyright">© {new Date().getFullYear()} {brandName} <span>Portail des acheteurs publics</span></div>}</section>
  <AccessStrip label="Bienvenue" paused={welcomePaused} onToggle={()=>setWelcomePaused(paused=>!paused)}>
   Bienvenue
  </AccessStrip>
  {screen==="access"&&<footer className="access-emblem-footer">
   <span>© {new Date().getFullYear()} {brandName}</span>
   <a href="https://commons.wikimedia.org/wiki/File:Coat_of_arms_of_Morocco_(simple).svg" target="_blank" rel="noreferrer">Crédits de l’emblème</a>
  </footer>}

 </main>:!ready||!buyer?<main className="page-width loading-page"><Skeleton className="h-12 w-72 mb-8"/><Skeleton className="h-72 w-full"/><p>Chargement de votre espace…</p>{error&&<p role="alert">{error}</p>}</main>:<><div className="session-strip"><span><ShieldCheck size={14}/>Espace acheteur public</span><span>Bienvenue, {buyer.name}</span></div>
 {screen==="hub"&&<div className="hub-theme"><main className="page-width hub-page compact-hub"><h1 className="sr-only">Services BDG</h1>
  <RemiseTicker rate={remiseRate}/>
  <div className="service-tiles">{navigation.map(([id,label])=><button className={`service-tile service-tile-${id}`} key={id} onClick={()=>go(id)}><span className="tile-icon"><ServiceIcon id={id} size={100}/></span><span>{label}</span><ChevronRight size={16} className="tile-arrow"/></button>)}</div>
  <button type="button" className="hub-contact" onClick={()=>go("autres")} aria-label="Contacter BDG"><Mail size={21}/></button>
 </main></div>}
 {isExtraService(screen)&&<main className="page-width document-page">
  <button className="breadcrumb" onClick={()=>go("hub")}>Services<ChevronRight size={15}/><span>{extraServices[screen]}</span></button>
  <div className="section-heading"><h1>{extraServices[screen]}</h1><div className="section-icon"><ServiceIcon id={screen} size={48}/></div></div>
  <BuyerService service={screen} company={store.settings.company}/>
 </main>}
 {screen==="requests"&&<main className="page-width document-page"><button className="breadcrumb" onClick={()=>go("hub")}>Services<ChevronRight size={15}/><span>Demandes</span></button><div className="section-heading"><div><span className="eyebrow">VOS DOCUMENTS</span><h1>{documentKind?DOCUMENT_TYPES[documentKind]:"Mes demandes"}<span>.</span></h1><p>Demandez votre facture ou votre bon de livraison et suivez sa préparation.</p></div><div className="section-icon"><ServiceIcon id={documentKind||"facture"} size={48}/></div></div><DocumentRequests buyer={buyer} initialKind={documentKind} onSessionExpired={()=>{clearPrivateSpace();router.replace("/");}}/></main>}
 {screen==="remise"&&<main className="page-width calculator-page">
  <button className="breadcrumb" onClick={()=>go("hub")}>Services<ChevronRight size={15}/><span>Remise d’achat</span></button>
  <div className="section-heading"><div><span className="eyebrow">VOTRE REMISE D’ACHAT</span><h1>Remise d’achat<span>.</span></h1><p>Une remise de {remiseRate} % appliquée à votre montant.</p></div><div className="section-icon"><Calculator size={28}/></div></div>
  <form className="calculator-layout" onChange={()=>{submissionKey.current=null;}} onSubmit={submit}>
   <div className="calculator-fields"><section className="form-section"><h2><span>01</span>Le montant à calculer</h2>
    <div className="two-fields remise-amount-fields"><Field label="Montant total du devis TTC"><input inputMode="decimal" required aria-label="Montant total du devis TTC" placeholder="Saisissez votre montant TTC" value={amount} onFocus={e=>e.target.select()} onChange={e=>setAmount(e.target.value)}/><span className="input-unit">MAD</span></Field>
     <div className="field"><span>Taux de remise</span><div className="fixed-rate"><strong>{remiseRate} %</strong><LockKeyhole size={17} aria-label="Taux fixe"/></div></div>
    </div><p className="field-note">Les montants sont arrondis au centime.</p>
   </section><section className="form-section"><h2><span>02</span>Votre demande</h2>
    <RequestFields buyer={buyer} onCityChange={()=>{submissionKey.current=null;}}/>
    <div className="payout-method-section"><h3>Recevoir ma remise d’achat</h3><RadioGroup className="payout-method-options" name="paymentMethod" required value={paymentMethod} onValueChange={v=>{setPaymentMethod(v);submissionKey.current=null;}} aria-label="Service de versement de la remise">{[["cashplus","Cash Plus","/images/cashplus-logo.svg"],["wafacash","Wafacash","/images/wafacash-logo.png"]].map(([id,name,image])=><label className={`payout-method${paymentMethod===id?" selected":""}`} htmlFor={`method-${id}`} key={id}><img src={image} alt={name}/><span><RadioGroupItem id={`method-${id}`} value={id}/>{name}</span></label>)}</RadioGroup><p className="payout-deadline"><Clock size={19}/><span><strong>Versement sous 24 heures</strong>Le versement de votre remise d’achat est prévu sous 24 heures. Votre code de transfert vous sera envoyé par email.</span></p></div>
    <div className="buyer-summary"><UserRound size={18}/><span><strong>{buyer.name}</strong><small>{buyer.email}</small></span></div>
    {error&&<p role="alert" className="form-error">{error}</p>}
    <button className="primary-button" disabled={busy||!calculation||calculation.amount<=0||!paymentMethod}>{busy?<Loader2 size={18} className="spin"/>:<CheckCircle2 size={18}/>}Confirmer ma demande</button>
   </section></div>
   <aside className="calculation-result"><div className="result-heading"><span>VOTRE CALCUL</span><BadgePercent size={23}/></div>
    <PriceBreakdown quote={calculation}/>
   </aside>
  </form>
 </main>}
 <footer className="site-footer page-width"><Brand name={brandName}/><div className="footer-copyright"><span>© {new Date().getFullYear()} {brandName}</span>{screen==="hub"&&<a className="hub-admin-access" href="/admin" onClick={prepareAdminVisit} aria-label="Espace admin" title="Espace admin"><ShieldCheck size={12}/></a>}</div><button className="text-button" onClick={logout} disabled={busy}><LogOut size={15}/>Se déconnecter</button></footer></>}
 {buyer&&hasAccount&&<AccountPanel open={accountOpen} onOpenChange={setAccountOpen} buyer={buyer} onChangePassword={async values=>{const epoch=authEpoch.current;const d=await api("account-password",values);if(epoch!==authEpoch.current)return;if(d.buyer)setBuyer(d.buyer);setHasAccount(!!d.hasAccount);}}/>}
 <Sheet open={menuOpen} onOpenChange={setMenuOpen}><SheetContent className="mobile-sheet"><SheetTitle><Brand name={brandName}/></SheetTitle><SheetDescription>Votre espace acheteur public</SheetDescription><nav>{navigation.map(([id,label])=><button key={id} aria-label={label} title={label} onClick={()=>go(id)}><ServiceIcon id={id} size={40}/></button>)}<button onClick={()=>{setMenuOpen(false);logout();}} disabled={busy}><LogOut size={18}/>Se déconnecter</button></nav></SheetContent></Sheet>
 <Dialog open={!!receipt} onOpenChange={o=>!o&&setReceipt(null)}><DialogContent className="receipt-dialog"><div className="receipt-icon"><CheckCircle2 size={33}/></div><DialogTitle>Votre demande est enregistrée.</DialogTitle><DialogDescription>{receipt?.customerNotification==="sent"?"Un email de confirmation avec les informations de votre demande et le PDF a été envoyé à votre email de contact.":"Votre demande est enregistrée. L’envoi de votre confirmation par email n’a pas encore été confirmé. Vous pouvez télécharger votre PDF ici."}</DialogDescription><div className="receipt-reference"><span>Référence de votre demande</span><strong>{receipt?.orderId}</strong></div>{receipt?.total!==undefined&&<div className="receipt-total"><span>Remise d’achat enregistrée</span><strong>{money(receipt.discount||0)}</strong><small>Prix après remise : {money(receipt.total)}</small></div>}{receipt&&<p className="receipt-deadline">Le versement de votre remise d’achat est prévu sous 24 heures via le service choisi.</p>}{receipt?.pdfUrl&&<a className="primary-button pdf-download" href={receipt.pdfUrl} download><Download size={18}/>Télécharger le PDF</a>}<button className="secondary-button" onClick={()=>setReceipt(null)}>Continuer</button></DialogContent></Dialog>
 </TooltipProvider></>;
}
