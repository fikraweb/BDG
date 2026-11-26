"use client";

import { useEffect, useState } from "react";
import { Building2, BadgePercent, Save, Loader2, ShieldCheck, RefreshCw, Coins, FileStack } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import SecurityPanel from "@/app/admin/security-panel";
import type {SecuritySettings} from "@/lib/security-types";
import DocumentsPanel from "@/app/admin/documents-panel";
import PayoutPanel from "@/app/admin/payout-panel";
import type {PayoutRequest} from "@/lib/payout-types";
import { money, calculateRemise } from "@/lib/catalog";
import { BRAND_NAME, COMPANY, type Company } from "@/lib/company";
import type { SiteStore } from "@/lib/site-types";

const companyFields: { key: keyof Company; label: string; max: number; type?: string }[] = [
  { key: "name", label: "Nom de l’entreprise", max: 100 }, { key: "phone", label: "Téléphone", max: 30, type: "tel" },
  { key: "email", label: "Email de l’entreprise", max: 254, type: "email" }, { key: "rib", label: "RIB", max: 60 },
  { key: "taxeProfessionnelle", label: "N° TP · Taxe professionnelle", max: 40 }, { key: "cnss", label: "N° CNSS", max: 40 }, { key: "ice", label: "ICE", max: 40 },
];
export default function Admin({ email,token,onSessionChange,onSessionExpired }: { email: string;token:string;onSessionChange:(value:{email:string;token:string})=>void;onSessionExpired:()=>void }) {
  const [store, setStore] = useState<SiteStore|null>(null), [company, setCompany] = useState<Company>({ ...COMPANY }), [rate, setRate] = useState("5");
  const [tab, setTab] = useState("documents");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [security,setSecurity]=useState<SecuritySettings|null>(null);
  const [payoutRequests,setPayoutRequests]=useState<PayoutRequest[]>([]);
  function apply(data: SiteStore & {payoutRequests?:PayoutRequest[];security?:SecuritySettings}) { setStore(data);if(data.security)setSecurity(data.security);if(data.payoutRequests)setPayoutRequests(data.payoutRequests); }
  async function load(remiseReference="") {
    setLoading(true); setError("");
    try { const r = await fetch("/api/admin"+(remiseReference?"?remiseReference="+encodeURIComponent(remiseReference):""), { cache: "no-store",headers:{Authorization:"Bearer "+token} }); const data = await r.json() as SiteStore & { error?: string }; if (!r.ok) {if(r.status===403)onSessionExpired();throw new Error(data.error);} apply(data); setCompany(data.settings.company); setRate(String(data.settings.remiseRate)); }
    catch (error) { setError((error as Error).message || "Impossible de charger l’administration."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function save(action: string, values: Record<string,unknown>): Promise<boolean> {
    if (busy) return false;
    setBusy(true); setError("");
    try { const r = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json",Authorization:"Bearer "+token }, body: JSON.stringify({ action, ...values }) }); const data = await r.json() as SiteStore & { error?: string;payoutRequests?:PayoutRequest[];payoutDelivery?:{status:string};sessionToken?:string;adminEmail?:string }; if (!r.ok) {if(r.status===403)onSessionExpired();throw new Error(data.error);} apply(data); if(data.sessionToken&&data.adminEmail)onSessionChange({email:data.adminEmail,token:data.sessionToken}); if(action==="payout-send"){if(data.payoutDelivery?.status!=="sent"){const message="Code enregistré, mais l’envoi de l’email n’a pas été confirmé. Réessayez avec le même code.";setError(message);toast.error(message);return false;}toast.success("Code de transfert envoyé au bénéficiaire.");return true;} toast.success("Modifications enregistrées."); return true; }
    catch (error) { const message = (error as Error).message || "L’enregistrement a échoué. Réessayez."; setError(message); toast.error(message); return false; }
    finally { setBusy(false); }
  }
  const sampleRate = Number(rate.replace(",", "."));
  const example = Number.isFinite(sampleRate) && sampleRate >= 0 && sampleRate <= 100 ? calculateRemise(1000, sampleRate) : null;
  const isLocked = busy || loading;
  return <div className="admin-shell"><Toaster position="top-center"/>
    <header className="admin-header"><a className="admin-brand" href="/"><span>{BRAND_NAME}<small>ESPACE ADMIN</small></span></a><div><span className="admin-account"><ShieldCheck size={16}/>{security?.adminEmail||email}</span><a className="secondary-button" href="/">Voir le site</a></div></header>
    <main className="admin-main"><div className="admin-title"><div><span className="eyebrow">ADMINISTRATION</span><h1>Gérer votre site<span>.</span></h1></div><button className="secondary-button" onClick={()=>void load()} disabled={isLocked}><RefreshCw size={16}/>Actualiser</button></div>
    <Tabs value={tab} onValueChange={value => { setTab(value); setError(""); }}><TabsList className="admin-tabs admin-side-menu" variant="line"><TabsTrigger value="documents"><FileStack size={17}/>Demandes</TabsTrigger><TabsTrigger value="company"><Building2 size={18}/>Entreprise</TabsTrigger><TabsTrigger value="remise"><BadgePercent size={18}/>Remise</TabsTrigger><TabsTrigger value="payouts"><Coins size={18}/>Versements</TabsTrigger><TabsTrigger value="security"><ShieldCheck size={18}/>Accès</TabsTrigger></TabsList></Tabs>
    {error && <div className="admin-error" role="alert">{error}</div>}
    {loading ? <div className="admin-loading"><Loader2 className="spin"/>Chargement des paramètres…</div> : !store ? <button className="primary-button" onClick={()=>void load()}>Réessayer</button> : <>
    {tab === "company" && <section className="admin-panel"><div className="admin-panel-heading"><h2>Informations de l’entreprise</h2><p>Ces coordonnées apparaissent sur les nouvelles demandes et leurs PDF.</p></div><form onSubmit={e => { e.preventDefault(); void save("settings-save", { company, remiseRate: store.settings.remiseRate, revision: store.settings.revision }); }}>
      <fieldset disabled={isLocked} className="admin-fields"><label className="field admin-full">Adresse<textarea required maxLength={400} rows={2} value={company.address} onChange={e => setCompany({ ...company, address: e.target.value })}/></label>{companyFields.map(field => <label className={`field${field.key === "name" ? " admin-full" : ""}`} key={field.key}>{field.label}<input type={field.type || "text"} maxLength={field.max} required value={company[field.key]} onChange={e => setCompany({ ...company, [field.key]: e.target.value })}/></label>)}</fieldset>
      <div className="admin-save"><button className="primary-button" disabled={isLocked}>{busy ? <Loader2 className="spin" size={18}/> : <Save size={18}/>}Enregistrer les coordonnées</button></div></form></section>}
    {tab === "remise" && <section className="admin-panel admin-remise-panel"><form onSubmit={e => { e.preventDefault(); void save("settings-save", { company: store.settings.company, remiseRate: sampleRate, revision: store.settings.revision }); }}><div className="admin-panel-heading"><h2>Pourcentage de remise</h2><p>Le taux s’applique aux demandes de remise.</p></div><label className="field admin-rate-field">Remise (%)<input inputMode="decimal" type="number" min={0} max={100} step="0.01" required value={rate} onChange={e => setRate(e.target.value)} disabled={isLocked}/></label><p className="admin-help">Les clients voient le taux et ne peuvent pas le modifier. Les anciennes demandes gardent leur calcul d’origine.</p><button className="primary-button" disabled={isLocked || !example}>{busy ? <Loader2 className="spin" size={18}/> : <Save size={18}/>}Enregistrer le taux</button></form><aside className="admin-rate-example"><span>REMISE D’ACHAT SUR 1 000 MAD</span><strong>{example ? money(example.discount) : "—"}</strong><dl><div><dt>Avant remise</dt><dd>{money(1000)}</dd></div><div><dt>Remise de {example?.rate ?? "—"} %</dt><dd>{example ? money(example.discount) : "—"}</dd></div></dl><small>Taux enregistré : {store.settings.remiseRate} %</small></aside></section>}
    {tab==="security"&&security&&<SecurityPanel settings={security} locked={isLocked} onSave={save}/>}
    {tab==="documents"&&<DocumentsPanel token={token} onSessionExpired={onSessionExpired} company={store.settings.company}/>}
    {tab==="payouts"&&<PayoutPanel requests={payoutRequests} locked={isLocked} onSend={values=>save("payout-send",values)} onSearch={q=>void load(q)}/>}
    </>}
    </main>
  </div>;
}
