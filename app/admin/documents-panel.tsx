"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { FileText, Search, RefreshCw, Plus, Trash2, Eye, Save, Send, Download, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DOCUMENT_TYPES, documentTotals, isStatementDocument, newDocumentDraft, type DocumentContact, type DocumentDraft, type DocumentKind, type DocumentRequest } from "@/lib/document-types";
import { PROCUREMENT_OPTIONS } from "@/lib/procurement";
import { money } from "@/lib/catalog";
import { COMPANY, type Company } from "@/lib/company";
import { emailDeliveryMessage } from "@/lib/email-delivery";
import DocumentNumberInput from "@/app/admin/document-number-input";
import DocumentReferenceInput from "@/app/admin/document-reference-input";
import { formatDocumentReference, normalizeDocumentReference } from "@/lib/document-reference";
type Origin = "customer" | "admin";
type DocumentReply = { requests: DocumentRequest[]; request: DocumentRequest; nextNumbers?: Record<DocumentKind, string>; error?: string };
export default function DocumentsPanel({ token, onSessionExpired, company = COMPANY }: { token: string; onSessionExpired: () => void; company?: Company }) {
  const [requests, setRequests] = useState<DocumentRequest[]>([]), [selected, setSelected] = useState<DocumentRequest | null>(null), [draft, setDraft] = useState<DocumentDraft | null>(null);
  const [origin, setOrigin] = useState<Origin>("customer");
  const listVersion = useRef(0);
  const [nextNumbers, setNextNumbers] = useState<Partial<Record<DocumentKind, string>>>({});
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [query, setQuery] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState(""), [confirmed, setConfirmed] = useState(false);
  const lock = useRef(false), form = useRef<HTMLFormElement>(null), createKey = useRef(""), automaticNumber = useRef(false);
  const headers = { Authorization: "Bearer " + token };
  async function fetchData(payload?: Record<string, unknown>, url = "/api/admin/documents") { const response = await fetch(url, { ...(payload ? { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(payload) } : { headers, cache: "no-store" }) }); if (response.status === 403 || response.status === 401) onSessionExpired(); if (!response.ok) { const data = await response.json() as DocumentReply; throw new Error(data.error || "L’opération a échoué."); } return response; }
  async function load(value = query, source = origin) {
    const version = ++listVersion.current;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ q: value, origin: source });
      const data = await (await fetchData(undefined, "/api/admin/documents?" + params)).json() as DocumentReply;
      if (listVersion.current !== version) return;
      setRequests(data.requests);
      if (data.nextNumbers) setNextNumbers(data.nextNumbers);
    } catch (err) {
      if (listVersion.current === version) setError((err as Error).message);
    } finally {
      if (listVersion.current === version) setLoading(false);
    }
  }
  function chooseOrigin(source: Origin) {
    setOrigin(source);
    void load(query, source);
  }
  function updateList(data: DocumentReply) {
    listVersion.current++;
    setOrigin(data.request.origin ?? "customer");
    setQuery("");
    setLoading(false);
    setRequests(data.requests);
    if (data.nextNumbers) setNextNumbers(data.nextNumbers);
  }
  useEffect(() => { void load(""); }, []);
  function open(value: DocumentRequest) { const initial = structuredClone(value.draft); automaticNumber.current = !value.numberAssigned && !value.locked && !value.hasPdf; if (automaticNumber.current) initial.number = nextNumbers[value.kind] || formatDocumentReference(1, initial.date.slice(0,4)); else if (!value.locked && !value.hasPdf) initial.number = normalizeDocumentReference(initial.number); initial.note = ""; initial.contact.note = ""; initial.contact.name = initial.contact.maitreOuvrage; setSelected(value); setDraft(initial); setConfirmed(false); setError(""); setNotice(""); }
  function create(kind: DocumentKind) {
    createKey.current = crypto.randomUUID();
    const contact: DocumentContact = { name: "", maitreOuvrage: "", reference: "", devisReference: "", objet: "", phone: "", email: "", city: "", procurementType: "bon_de_commande", note: "" };
    const now = Date.now(), initial = newDocumentDraft(createKey.current.replaceAll("-", "").toUpperCase(), kind, contact, company);
    open({ id: "", kind, origin: "admin", contact, draft: initial, revision: 1, status: "draft", createdAt: now, updatedAt: now, companyNotification: "not_requested", customerNotification: "not_requested", hasPdf: false, locked: false, companyDelivery: null, customerDelivery: null });
  }
  const frozen = !!selected?.locked || !!selected?.hasPdf || selected?.status === "pending" || selected?.status === "sent";
  function edit(value: Partial<DocumentDraft>) { if (draft) setDraft({ ...draft, ...value }); setConfirmed(false); setNotice(""); }
  async function operation(action: "save" | "preview" | "send", event?: FormEvent) {
    event?.preventDefault(); if (!selected || !draft || lock.current) return;
    if (!frozen && !form.current?.reportValidity()) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    const listUrl = "/api/admin/documents?origin=" + (selected.origin ?? "customer");
    try {
      if (action === "preview") {
        const response = selected.hasPdf ? await fetchData(undefined, "/api/admin/documents?pdf=" + selected.id) : await fetchData({ action, id: selected.id, kind: selected.kind, draft });
        const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = (selected.hasPdf ? draft.number.replace(/[^a-zA-Z0-9_-]/g, "-") : "APERCU-" + selected.id) + ".pdf"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
        setNotice(selected.hasPdf ? "Le document enregistré a été téléchargé." : "L’aperçu PDF a été téléchargé. Vérifiez-le avant l’envoi.");
      } else {
        let current = selected;
        if (!frozen) { const payload = selected.id ? { action: "save", id: selected.id, revision: selected.revision, draft, autoNumber: automaticNumber.current } : { action: "create", kind: selected.kind, idempotencyKey: createKey.current, draft, autoNumber: automaticNumber.current }; const saved = await (await fetchData(payload, listUrl)).json() as DocumentReply; updateList(saved); automaticNumber.current = false; current = saved.request; setSelected(current); setDraft(structuredClone(current.draft)); }
        if (action === "send") { const data = await (await fetchData({ action, id: current.id, revision: current.revision, confirmed }, listUrl)).json() as DocumentReply; updateList(data); setSelected(data.request); setDraft(structuredClone(data.request.draft)); if (data.request.customerDelivery === "sent") setNotice("Le PDF a été envoyé à " + current.draft.contact.email + "." + (data.request.companyDelivery !== "sent" ? " Copie à l’administration : " + emailDeliveryMessage(data.request.companyError) : " Une copie a été envoyée à l’administration.")); else setError("Le PDF est enregistré. " + emailDeliveryMessage(data.request.customerError)); }
        else setNotice("Le brouillon est enregistré. Vous pouvez le reprendre plus tard.");
      }
    } catch (err) { setError((err as Error).message || "Impossible de traiter la demande."); } finally { setBusy(false); lock.current = false; }
  }
  const label = (request: DocumentRequest) => request.status === "sent" ? "PDF envoyé au client" : request.status === "pending" ? "Envoi en cours" : request.status === "failed" ? "Envoi non confirmé" : request.status === "draft" ? "Brouillon enregistré" : "Nouvelle demande";
  const totals = draft ? documentTotals(draft) : null;
  const market = draft?.contact.procurementType === "marches";
  const statement = selected && isStatementDocument(selected.kind);
  const editorTitle = selected?.kind === "facture" && market ? "Bordereau des prix – détail estimatif" : selected ? DOCUMENT_TYPES[selected.kind] : "Document";
  return <section className="admin-panel documents-admin-panel"><div className="admin-panel-heading"><h2>Documents et demandes</h2><p>Préparez les demandes reçues ou créez un document pour le destinataire de votre choix.</p></div>
    <div className="document-create-actions">
      <button type="button" className={origin === "customer" ? "primary-button" : "secondary-button"} disabled={busy} aria-pressed={origin === "customer"} onClick={() => chooseOrigin("customer")}>Demandes des clients</button>
      <button type="button" className={origin === "admin" ? "primary-button" : "secondary-button"} disabled={busy} aria-pressed={origin === "admin"} onClick={() => chooseOrigin("admin")}>Documents créés</button>
      <DropdownMenu>
        <DropdownMenuTrigger className="secondary-button" disabled={busy}><Plus size={18}/>Créer</DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="admin-document-create-menu" onCloseAutoFocus={event => { if (selected) event.preventDefault(); }}>
          {(Object.keys(DOCUMENT_TYPES) as DocumentKind[]).map(kind => <DropdownMenuItem key={kind} onSelect={() => create(kind)}>
            {kind === "facture" ? "Facture / Bordereau des prix" : DOCUMENT_TYPES[kind]}
          </DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <form className="payout-search" onSubmit={event => { event.preventDefault(); void load(); }}><label className="admin-search"><Search size={18}/><input aria-label="Rechercher une demande de document" placeholder="Nom, email ou référence…" value={query} onChange={event => setQuery(event.target.value)}/></label><button className="secondary-button" disabled={loading || busy}><RefreshCw size={16}/>Rechercher / actualiser</button></form>
    <p className="document-list-note">Les 100 demandes les plus récentes sont affichées. La recherche consulte également les anciennes demandes.</p>
    {!selected && error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <p><Loader2 size={18} className="spin"/>Chargement des demandes…</p> : !requests.length ? <div className="admin-empty">Aucune demande de document à afficher.</div> : <div className="document-request-list">{requests.map(request => <article className="document-request-row" key={request.id}><div><span className="document-status">{label(request)}</span>{request.origin === "admin" && <small className="document-origin">Créé dans l’administration</small>}<h3>{DOCUMENT_TYPES[request.kind]} · {request.contact.name}</h3><strong>{request.id}</strong><p>{request.contact.email} · {request.contact.phone}</p><small>{request.contact.maitreOuvrage} · Réf. {request.contact.reference}</small></div><button className="secondary-button" disabled={busy} onClick={() => open(request)}><FileText size={17}/>{request.hasPdf ? "Consulter le document" : "Préparer le document"}</button></article>)}</div>}
    <Dialog open={!!selected} onOpenChange={value => { if (!value && !busy) { setSelected(null); setDraft(null); setError(""); } }}><DialogContent className="document-editor-dialog"><DialogTitle>{editorTitle}</DialogTitle><DialogDescription>{selected?.id ? selected.id + " · " + selected.contact.name + " · " + selected.contact.email : "Nouveau document · Renseignez les coordonnées du destinataire."}</DialogDescription>
      {draft && selected && <form ref={form} onSubmit={event => void operation("save", event)}><fieldset className="document-form-grid" disabled={busy || frozen}>
        <DocumentReferenceInput label={selected.kind === "facture" ? market ? "Référence du bordereau" : "Référence de facture (Ref F:)" : statement ? "Référence du document" : selected.kind === "echantillons" ? "Référence du bon de livraison des échantillons" : "Référence du bon de livraison"} value={draft.number} readOnly={frozen} onValueChange={number => { automaticNumber.current = false; edit({ number }); }}/>
        <label className="field">Date d’émission<input required type="date" value={draft.date} onChange={event => edit({ date: event.target.value })}/></label>
        <label className="field">Cadre d’achat<select className="procurement-select" value={draft.contact.procurementType} onChange={event => edit({ contact: { ...draft.contact, procurementType: event.target.value as DocumentDraft["contact"]["procurementType"] } })}>{Object.entries(PROCUREMENT_OPTIONS).map(([value, name]) => <option value={value} key={value}>{name}</option>)}</select></label>
        {([{ key: "maitreOuvrage", label: "Client / Maître d’ouvrage", max: 200 }, { key: "reference", label: statement ? "Référence liée (facultatif)" : "Référence de facture (Ref F:) (facultatif)", max: 100 }, { key: "devisReference", label: "Référence du devis", max: 100 }] as const).filter(field => field.key !== "reference" || selected.kind !== "facture").map(field => <label className="field" key={field.key}>{field.label}<input required={field.key === "maitreOuvrage"} maxLength={field.max} value={draft.contact[field.key]} onChange={event => edit({ contact: { ...draft.contact, [field.key]: event.target.value, ...(field.key === "maitreOuvrage" ? { name: event.target.value } : {}) } })}/></label>)}
        {market && !statement && <><label className="field document-span-all">Administration · Royaume du Maroc, ministère, préfecture / province, commune<textarea required rows={5} maxLength={1000} placeholder={"ROYAUME DU MAROC\nMINISTÈRE DE L’INTÉRIEUR\nPRÉFECTURE / PROVINCE DE…\nCOMMUNE DE…"} value={draft.authority || ""} onChange={event => edit({ authority: event.target.value })}/></label><label className="field">Appel d’offres N°<input required maxLength={100} value={draft.tenderReference || ""} onChange={event => edit({ tenderReference: event.target.value })}/></label><label className="field">Marché N°<input required maxLength={100} value={draft.marketReference || ""} onChange={event => edit({ marketReference: event.target.value })}/></label></>}
        <label className="field">Email de réception · absent du PDF<input type="email" required maxLength={254} value={draft.contact.email} readOnly={selected.origin !== "admin"} onChange={event => edit({ contact: { ...draft.contact, email: event.target.value } })}/></label>
        <label className="field document-span-all">Objet de la prestation<textarea required maxLength={1000} rows={3} placeholder="Ex. : Fourniture et installation de mobilier de bureaux" value={draft.contact.objet} onChange={event => edit({ contact: { ...draft.contact, objet: event.target.value } })}/></label>
        {selected.kind === "facture" && <><label className="field">RIB<input maxLength={60} value={draft.rib} onChange={event => edit({ rib: event.target.value })}/></label><label className="field">Banque / agence<input maxLength={200} value={draft.bank} onChange={event => edit({ bank: event.target.value })}/></label><label className="field">TVA (%)<DocumentNumberInput min={0} max={100} step="0.01" value={draft.taxRate} onValueChange={taxRate => edit({ taxRate })}/></label></>}
        {statement ? <label className="field document-span-all">Contenu du document<textarea required rows={10} maxLength={8000} value={draft.statement ?? ""} onChange={event => edit({ statement: event.target.value })}/></label> :
        <div className="document-span-all document-editor-lines"><h3>Désignation des prestations</h3>{draft.items.map((item, index) => <div className="document-editor-line" key={index}><label className="field document-line-description">Article {index + 1} · désignation / caractéristiques<textarea required rows={4} maxLength={4000} value={item.designation} onChange={event => edit({ items: draft.items.map((value, n) => n === index ? { ...value, designation: event.target.value } : value) })}/></label><label className="field">Unité<input required maxLength={10} value={item.unit} onChange={event => edit({ items: draft.items.map((value, n) => n === index ? { ...value, unit: event.target.value } : value) })}/></label><label className="field">Quantité<DocumentNumberInput min={0.001} max={100000} step="0.001" value={item.quantity} onValueChange={quantity => edit({ items: draft.items.map((value, n) => n === index ? { ...value, quantity } : value) })}/></label>{selected.kind === "facture" && <label className="field">Prix unitaire HT (MAD)<DocumentNumberInput min={0} max={100000000} step="0.01" value={item.unitPrice} onValueChange={unitPrice => edit({ items: draft.items.map((value, n) => n === index ? { ...value, unitPrice } : value) })}/></label>}<button type="button" className="icon-button" disabled={draft.items.length === 1} aria-label={"Retirer l’article " + (index + 1)} onClick={() => edit({ items: draft.items.filter((_, n) => n !== index) })}><Trash2 size={18}/></button></div>)}<button type="button" className="secondary-button" disabled={draft.items.length >= 40} onClick={() => edit({ items: [...draft.items, { designation: "", unit: "U", quantity: 1, unitPrice: 0 }] })}><Plus size={17}/>Ajouter une ligne</button></div>}
      </fieldset>
      {selected.kind === "facture" && totals && <dl className="document-invoice-totals"><div><dt>Total HT</dt><dd>{money(totals.subtotal)}</dd></div><div><dt>TVA {draft.taxRate} %</dt><dd>{money(totals.tax)}</dd></div><div><dt>Total TTC · dirhams marocains</dt><dd>{money(totals.total)}</dd></div></dl>}
      <div className="document-signature-preview"><strong>Cachet et signature</strong><span>Un espace libre est prévu dans le PDF pour votre cachet et votre signature.</span></div>
      {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="document-notice" role="status">{notice}</p>}
      {selected.status !== "sent" && <label className="document-send-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)}/>J’ai vérifié les informations du document et son destinataire : {draft.contact.email || "email à renseigner"}.</label>}
      <div className="document-editor-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => void operation("preview")}>{selected.hasPdf ? <Download size={17}/> : <Eye size={17}/>} {selected.hasPdf ? "Télécharger le PDF" : "Aperçu PDF"}</button>{!frozen && <button className="secondary-button" disabled={busy}><Save size={17}/>Enregistrer le brouillon</button>}{selected.status !== "sent" && <button type="button" className="primary-button" disabled={busy || !confirmed || (selected.status === "pending" && Date.now() - selected.updatedAt < 120000)} onClick={() => void operation("send")}>{busy ? <Loader2 size={17} className="spin"/> : <Send size={17}/>} {selected.status === "failed" ? "Réessayer l’envoi du PDF" : "Envoyer le PDF au client"}</button>}</div>
      </form>}
    </DialogContent></Dialog>
  </section>;
}
