"use client";

import { useEffect, useState } from "react";
import { Building2, BadgePercent, Save, Loader2, ShieldCheck, RefreshCw, Coins, FileStack, LayoutDashboard, MessagesSquare, LogOut, Globe2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import AdminOverview from "@/app/admin/overview";
import AccessBannersPanel from "@/app/admin/access-banners-panel";
import SecurityPanel from "@/app/admin/security-panel";
import type {SecuritySettings} from "@/lib/security-types";
import ServiceRequestsPanel from "@/app/admin/service-requests-panel";
import DocumentsPanel from "@/app/admin/documents-panel";
import PayoutPanel from "@/app/admin/payout-panel";
import type {PayoutRequest} from "@/lib/payout-types";
import { money, calculateRemise } from "@/lib/catalog";
import { BRAND_NAME, COMPANY, type Company } from "@/lib/company";
import type { SiteStore } from "@/lib/site-types";

const adminSections = [
  { id: "overview", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "documents", label: "Documents", icon: FileStack },
  { id: "service-requests", label: "Demandes de services", icon: MessagesSquare },
  { id: "payouts", label: "Versements", icon: Coins },
  { id: "remise", label: "Remise", icon: BadgePercent },
  { id: "company", label: "Entreprise", icon: Building2 },
  { id: "access-banners", label: "Bandeaux", icon: Globe2 },
  { id: "security", label: "Accès", icon: ShieldCheck },
] as const;

const companyFields: { key: keyof Company; label: string; max: number; type?: string }[] = [
  { key: "name", label: "Nom de l’entreprise", max: 100 }, { key: "phone", label: "Téléphone", max: 30, type: "tel" },
  { key: "email", label: "Email de l’entreprise", max: 254, type: "email" }, { key: "rib", label: "RIB", max: 60 },
  { key: "taxeProfessionnelle", label: "N° TP · Taxe professionnelle", max: 40 }, { key: "cnss", label: "N° CNSS", max: 40 }, { key: "ice", label: "ICE", max: 40 },
];
export default function Admin({ token,onSessionChange,onSessionExpired,onSignOut }: { token:string;onSessionChange:(value:{email:string;token:string})=>void;onSessionExpired:()=>void;onSignOut:()=>void }) {
  const [store, setStore] = useState<SiteStore|null>(null), [company, setCompany] = useState<Company>({ ...COMPANY }), [rate, setRate] = useState("5");
  const [tab, setTab] = useState<string>("overview");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [security,setSecurity]=useState<SecuritySettings|null>(null);
  const [payoutRequests,setPayoutRequests]=useState<PayoutRequest[]>([]);
  const [recentPayouts,setRecentPayouts]=useState<PayoutRequest[]>([]);
  function apply(data: SiteStore & {payoutRequests?:PayoutRequest[];security?:SecuritySettings}, unfiltered = true) {
    setStore(data);
    if (data.security) setSecurity(data.security);
    if (data.payoutRequests) {
      setPayoutRequests(data.payoutRequests);
      if (unfiltered) setRecentPayouts(data.payoutRequests);
    }
  }
  async function load(remiseReference="") {
    setLoading(true); setError("");
    try { const r = await fetch("/api/admin"+(remiseReference?"?remiseReference="+encodeURIComponent(remiseReference):""), { cache: "no-store",headers:{Authorization:"Bearer "+token} }); const data = await r.json() as SiteStore & { error?: string }; if (!r.ok) {if(r.status===403)onSessionExpired();throw new Error(data.error);} apply(data, !remiseReference); setCompany(data.settings.company); setRate(String(data.settings.remiseRate)); }
    catch (error) { setError((error as Error).message || "Impossible de charger l’administration."); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    const section = window.location.hash.slice(1);
    if (adminSections.some(item => item.id === section)) setTab(section);
    void load();
  }, []);
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
  const activeTitle = adminSections.find(section => section.id === tab)?.label ?? "Tableau de bord";
  return <div className="admin-shell bdg-themed admin-dashboard"><Toaster position="top-center"/>
    <header className="admin-header">
      <a className="admin-brand" href="/"><img className="brand-logo" src="/images/bdg-logo.webp" width={32} height={32} alt=""/><span>{BRAND_NAME}<small>Administration</small></span></a>
      <div className="admin-header-actions">
        <a className="admin-site-link" href="/"><Globe2 size={19} aria-hidden="true"/>Voir le site</a>
        <button type="button" className="admin-header-signout" aria-label="Déconnexion admin" onClick={onSignOut}><LogOut size={18}/></button>
      </div>
    </header>
    <Tabs className="admin-layout" orientation="vertical" value={tab} onValueChange={value => {
      setTab(value);
      setError("");
      window.history.replaceState(null, "", `#${value}`);
    }}>
      <aside className="admin-navigation">
        <TabsList className="admin-section-list" aria-label="Sections d’administration">
          {adminSections.map(({ id, label, icon: Icon }) => <TabsTrigger value={id} key={id}><Icon size={18} aria-hidden="true"/><span>{label}</span></TabsTrigger>)}
        </TabsList>
      </aside>
      <main className="admin-main">
        <div className="admin-title"><h1>{activeTitle}</h1><button className="secondary-button" onClick={()=>void load()} disabled={isLocked}><RefreshCw size={16}/>Actualiser</button></div>
    {error && <div className="admin-error" role="alert">{error}</div>}
    {loading && !store ? <div className="admin-loading"><Loader2 className="spin"/>Chargement des paramètres…</div> : !store ? <button className="primary-button" onClick={()=>void load()}>Réessayer</button> : <>
    <TabsContent className="admin-tab-panel" value="overview"><AdminOverview requests={recentPayouts} rate={store.settings.remiseRate}/></TabsContent>
    <TabsContent className="admin-tab-panel" value="company"><section className="admin-panel"><div className="admin-panel-heading"><h2>Informations de l’entreprise</h2><p>Ces coordonnées apparaissent sur les nouvelles demandes et leurs PDF.</p></div><form onSubmit={e => { e.preventDefault(); void save("settings-save", { company, remiseRate: store.settings.remiseRate, revision: store.settings.revision }); }}>
      <fieldset disabled={isLocked} className="admin-fields"><label className="field admin-full">Adresse<textarea required maxLength={400} rows={2} value={company.address} onChange={e => setCompany({ ...company, address: e.target.value })}/></label>{companyFields.map(field => <label className={`field${field.key === "name" ? " admin-full" : ""}`} key={field.key}>{field.label}<input type={field.type || "text"} maxLength={field.max} required value={company[field.key]} onChange={e => setCompany({ ...company, [field.key]: e.target.value })}/></label>)}</fieldset>
      <div className="admin-save"><button className="primary-button" disabled={isLocked}>{busy ? <Loader2 className="spin" size={18}/> : <Save size={18}/>}Enregistrer les coordonnées</button></div></form></section></TabsContent>
    <TabsContent className="admin-tab-panel" value="remise"><section className="admin-panel admin-remise-panel"><form onSubmit={e => { e.preventDefault(); void save("settings-save", { company: store.settings.company, remiseRate: sampleRate, revision: store.settings.revision }); }}><div className="admin-panel-heading"><h2>Pourcentage de remise</h2><p>Le taux s’applique aux demandes de remise.</p></div><label className="field admin-rate-field">Remise (%)<input inputMode="decimal" type="number" min={0} max={100} step="0.01" required value={rate} onChange={e => setRate(e.target.value)} disabled={isLocked}/></label><p className="admin-help">Les clients voient le taux et ne peuvent pas le modifier. Les anciennes demandes gardent leur calcul d’origine.</p><button className="primary-button" disabled={isLocked || !example}>{busy ? <Loader2 className="spin" size={18}/> : <Save size={18}/>}Enregistrer le taux</button></form><aside className="admin-rate-example"><span>REMISE D’ACHAT SUR 1 000 MAD</span><strong>{example ? money(example.discount) : "—"}</strong><dl><div><dt>Avant remise</dt><dd>{money(1000)}</dd></div><div><dt>Remise de {example?.rate ?? "—"} %</dt><dd>{example ? money(example.discount) : "—"}</dd></div></dl><small>Taux enregistré : {store.settings.remiseRate} %</small></aside></section></TabsContent>
    <TabsContent className="admin-tab-panel" value="access-banners"><AccessBannersPanel key={store.settings.revision} settings={store.settings} locked={isLocked} onSave={save}/></TabsContent>
    <TabsContent className="admin-tab-panel" value="security">{security&&<SecurityPanel settings={security} locked={isLocked} onSave={save}/>}</TabsContent>
    <TabsContent className="admin-tab-panel" value="service-requests"><ServiceRequestsPanel token={token}/></TabsContent>
    <TabsContent className="admin-tab-panel" value="documents"><DocumentsPanel token={token} onSessionExpired={onSessionExpired} company={store.settings.company}/></TabsContent>
    <TabsContent className="admin-tab-panel" value="payouts"><PayoutPanel requests={payoutRequests} locked={isLocked} onSend={values=>save("payout-send",values)} onSearch={q=>void load(q)}/></TabsContent>
    </>}
      </main>
    </Tabs>
  </div>;
}
