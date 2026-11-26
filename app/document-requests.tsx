"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send, Loader2, Download, RefreshCw, CheckCircle2, X } from "lucide-react";
import CityField from "@/app/city-field";
import type { Buyer } from "@/lib/catalog";
import { DOCUMENT_TYPES, requestStatus, type DocumentKind, type DocumentRequest } from "@/lib/document-types";
import { PROCUREMENT_OPTIONS } from "@/lib/procurement";
type DocumentReply = { requests: DocumentRequest[]; request: DocumentRequest; error?: string };
export default function DocumentRequests({ buyer, onSessionExpired, initialKind = null }: { buyer: Buyer; onSessionExpired: () => void; initialKind?: DocumentKind | null }) {
  const [kind, setKind] = useState<DocumentKind | null>(initialKind), [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState<DocumentRequest | null>(null);
  const key = useRef<string | null>(null), lock = useRef(false);
  async function load() { setLoading(true); setError(""); try { const response = await fetch("/api/documents", { cache: "no-store" }), data = await response.json() as DocumentReply; if (!response.ok) { if (response.status === 401 || response.status === 403) onSessionExpired(); throw new Error(data.error); } setRequests(data.requests); } catch (err) { setError((err as Error).message || "Impossible de charger vos demandes."); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  useEffect(() => { setKind(initialKind); setError(""); setSaved(null); key.current = null; }, [initialKind]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current || !kind) return; lock.current = true; setBusy(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget)); key.current ||= crypto.randomUUID();
    try { const response = await fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, ...values, idempotencyKey: key.current }) }), data = await response.json() as DocumentReply; if (!response.ok) { if (response.status === 401 || response.status === 403) onSessionExpired(); throw new Error(data.error); } setRequests(data.requests); setSaved(data.request); setKind(null); key.current = null; }
    catch (err) { setError((err as Error).message || "Votre demande n’a pas pu être enregistrée. Réessayez."); } finally { lock.current = false; setBusy(false); }
  }
  return <div className="documents-workspace">
    {!kind && initialKind && <button type="button" className="secondary-button" disabled={busy} onClick={() => { setKind(initialKind); setSaved(null); setError(""); key.current = null; }}>Nouvelle demande de {DOCUMENT_TYPES[initialKind].toLowerCase()}</button>}
    {saved && <section className="document-confirmation" role="status"><CheckCircle2 size={24}/><div><h2>Votre demande a été enregistrée</h2><p>{DOCUMENT_TYPES[saved.kind]} · {saved.id}</p><p>{saved.customerNotification === "sent" ? "Un email de confirmation vous a été envoyé. Le document demandé vous sera transmis après sa préparation par notre service administratif." : "Votre demande est bien enregistrée. L’envoi de l’email de confirmation n’a pas été confirmé; vous pouvez suivre la demande ci-dessous."}</p></div></section>}
    {kind && <form className="document-request-form form-section" onSubmit={submit} onChange={() => { key.current = null; }} key={kind}>
      <div className="document-heading-row"><h2>Demande de {DOCUMENT_TYPES[kind].toLowerCase()}</h2><button type="button" className="icon-button" disabled={busy} onClick={() => setKind(null)} aria-label="Fermer le formulaire"><X size={20}/></button></div>
      <fieldset className="document-form-grid" disabled={busy}>
        <label className="field">Nom et prénom<input name="name" required maxLength={160} autoComplete="name" defaultValue={buyer.name}/></label>
        <label className="field">Cadre d’achat<select className="procurement-select" name="procurementType" required defaultValue={buyer.procurementType || ""}><option disabled value="">Choisissez votre cadre d’achat</option>{Object.entries(PROCUREMENT_OPTIONS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="field document-span-all">Maître d’ouvrage<input name="maitreOuvrage" required maxLength={200} defaultValue={buyer.maitreOuvrage || ""}/></label>
        <label className="field">Référence du bon de commande / marché<input name="reference" required maxLength={100} placeholder="Ex. : 54/DAS/2026"/></label>
        <label className="field">Référence du devis / de la commande (facultatif)<input name="devisReference" maxLength={100}/></label>
        <label className="field document-span-all">Objet de la prestation<textarea name="objet" required maxLength={1000} rows={3} placeholder="Ex. : Fourniture et installation de mobilier de bureaux"/></label>
        <label className="field">Téléphone<input name="phone" type="tel" required maxLength={30} autoComplete="tel" defaultValue={buyer.phone}/></label>
        <label className="field">Email de réception<input name="email" type="email" required maxLength={254} autoComplete="email" defaultValue={buyer.email}/></label>
        <CityField defaultValue={buyer.city || ""} className="document-span-all" disabled={busy} onValueChange={() => { key.current = null; }}/>
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" disabled={busy}>{busy ? <Loader2 size={18} className="spin"/> : <Send size={18}/>}Envoyer ma demande</button>
    </form>}
    {!kind && <section className="document-history"><div className="document-heading-row"><div><h2>Mes demandes</h2><p>Retrouvez vos demandes et les documents préparés pour vous.</p></div><button className="secondary-button" disabled={loading || busy} onClick={() => void load()}><RefreshCw size={16}/>Actualiser</button></div>
      {!kind && error && <p className="form-error" role="alert">{error}</p>}
      {loading ? <p><Loader2 size={18} className="spin"/>Chargement de vos demandes…</p> : !requests.length ? <div className="admin-empty">Vous n’avez pas encore envoyé de demande.</div> : <div className="document-request-list">{requests.map(request => <article className="document-request-row" key={request.id}><div><h3>{DOCUMENT_TYPES[request.kind]}</h3><strong>{request.id}</strong><p>{request.contact.reference} · {request.contact.maitreOuvrage}</p><small>{new Intl.DateTimeFormat("fr-MA", { dateStyle: "medium", timeZone: "Africa/Casablanca" }).format(request.createdAt)}</small></div><div className="document-row-actions"><span className={`document-status${request.hasPdf ? " available" : ""}`}>{requestStatus(request)}</span><a className="secondary-button" href={"/api/documents?receipt=" + request.id}><Download size={16}/>Accusé de réception</a>{request.hasPdf && <a className="primary-button" href={"/api/documents?pdf=" + request.id}><Download size={16}/>Mon document PDF</a>}</div></article>)}</div>}
    </section>}
  </div>;
}
