import { ApiError, db, textField, cityField, emailField, phoneField, procurementField, hash, notify } from "@/lib/server";
import { readSettings } from "@/lib/site-store";
import { createBusinessPdf } from "@/lib/document-pdf";
import { documentEmails } from "@/lib/document-email";
import { saveDocumentBytes, readDocumentBytes, findDocumentBytes } from "@/lib/document-storage";
import { documentBuyer, documentTotals, isDocumentKind, newDocumentDraft, type DocumentContact, type DocumentDraft, type DocumentKind, type DocumentRequest, type IssuedDocument } from "@/lib/document-types";
import type { Buyer } from "@/lib/catalog";
import type { Company } from "@/lib/company";
import { NEXT_DOCUMENT_NUMBER_SQL, numberingParameters } from "@/lib/document-numbering";
import { normalizeDocumentReference, parseDocumentReference } from "@/lib/document-reference";
type Row = { id: string; buyer_id: string | null; kind: DocumentKind; details: string; draft: string; revision: number; ack_company_status: string; ack_customer_status: string; ack_claim: string | null; send_status: "not_sent" | "pending" | "failed" | "sent"; send_event: string | null; send_claim: string | null; company_delivery: string | null; customer_delivery: string | null; company_error: string | null; customer_error: string | null; issued: string | null; pdf_key: string | null; document_number: string | null; created_at: number; updated_at: number };
function cityContact(input: DocumentContact & { address?: string }): DocumentContact { const { address: _legacyAddress, ...contact } = input; return { ...contact, city: contact.city || "" }; }
const snapshot = (row: Row) => { const value = JSON.parse(row.details) as { contact: DocumentContact; company: Company }; return { ...value, contact: cityContact(value.contact) }; };
const storedDraft = (row: Row): DocumentDraft => { const value = JSON.parse(row.draft) as DocumentDraft; return { ...value, contact: cityContact(value.contact) }; };
const summary = (row: Row): DocumentRequest => ({ id: row.id, kind: row.kind, origin: row.buyer_id ? "customer" : "admin", contact: row.buyer_id ? snapshot(row).contact : storedDraft(row).contact, draft: storedDraft(row), revision: row.revision, status: row.send_status === "not_sent" ? row.revision > 1 || !row.buyer_id ? "draft" : "new" : row.send_status, companyNotification: row.ack_company_status, customerNotification: row.ack_customer_status, hasPdf: !!row.pdf_key, numberAssigned: !!row.document_number, locked: !!row.send_event, companyDelivery: row.company_delivery, customerDelivery: row.customer_delivery, companyError: row.company_error, customerError: row.customer_error, createdAt: row.created_at, updatedAt: row.updated_at });
function requestId(input: unknown) { const id = textField(input, "La demande", 40); if (!/^TZ-R-[A-F0-9]{12}$/.test(id)) throw new ApiError("Demande introuvable.", 404); return id; }
async function checkDocumentReference(kind: DocumentKind, number: string, excludeId = "") {
  const parts = parseDocumentReference(number);
  if (!parts) return;
  const legacy = parts.sequence + "/" + parts.year;
  const existing = await db().prepare("SELECT id FROM document_requests WHERE kind=? AND id<>? AND document_number IN (?,?) LIMIT 1").bind(kind, excludeId, number, legacy).first<{ id: string }>();
  if (existing) throw new ApiError("Cette référence existe déjà pour ce type de document. Choisissez un autre numéro.", 409);
}
export async function findDocumentRequest(id: unknown, buyerId?: string) {
  const row = await db().prepare("SELECT * FROM document_requests WHERE id=?" + (buyerId ? " AND buyer_id=?" : "")).bind(...(buyerId ? [requestId(id), buyerId] : [requestId(id)])).first<Row>();
  if (!row) throw new ApiError("Demande introuvable.", 404); return row;
}
function contactFields(input: Record<string, unknown>, buyer?: Buyer, administrative = false): DocumentContact {
  const maitreOuvrage = textField(input.maitreOuvrage ?? buyer?.maitreOuvrage, "Le maître d’ouvrage", 200);
  return { name: administrative ? maitreOuvrage : textField(input.name ?? buyer?.name, "Le nom du client", 160), maitreOuvrage, reference: administrative && !input.reference ? "" : textField(input.reference, "La référence du bon de commande / marché", 100), devisReference: input.devisReference ? textField(input.devisReference, "La référence du devis", 100) : "", objet: textField(input.objet, "L’objet de la prestation", 1000), phone: administrative ? "" : phoneField(input.phone ?? buyer?.phone), email: emailField(input.email ?? buyer?.email), city: administrative ? "" : cityField(input.city ?? buyer?.city), procurementType: procurementField(input.procurementType ?? buyer?.procurementType), note: "" };
}
export async function listDocumentRequests(buyerId?: string, query = "") {
  const values: string[] = [], where: string[] = [];
  if (buyerId) { where.push("buyer_id=?"); values.push(buyerId); }
  if (query) { where.push("(instr(lower(id),?)>0 OR instr(lower(details),?)>0 OR instr(lower(draft),?)>0)"); values.push(...Array(3).fill(query.slice(0, 160).toLowerCase())); }
  const result = await db().prepare("SELECT * FROM document_requests" + (where.length ? " WHERE " + where.join(" AND ") : "") + " ORDER BY created_at DESC LIMIT 100").bind(...values).all<Row>();
  return result.results.map(row => { const value = summary(row); if (!buyerId) return value; const { draft, companyDelivery, customerDelivery, companyError, customerError, ...publicValue } = value; return publicValue; });
}
export async function createAdminDocument(body: Record<string, unknown>) {
  if (!isDocumentKind(body.kind)) throw new ApiError("Choisissez le document à créer.");
  const idem = textField(body.idempotencyKey, "La référence", 100);
  const id = "TZ-R-" + (await hash("admin-document:" + body.kind + ":" + idem)).slice(0, 12).toUpperCase();
  const existing = await db().prepare("SELECT * FROM document_requests WHERE id=? AND buyer_id IS NULL").bind(id).first<Row>();
  if (existing) return summary(existing);
  const contact = contactFields((body.draft as DocumentDraft | undefined)?.contact || {}, undefined, true);
  const draft = validateDocumentDraft(body.draft, contact, false), company = (await readSettings()).company, now = Date.now();
  const automatic = body.autoNumber !== false;
  if (!automatic) await checkDocumentReference(body.kind, draft.number, id);
  try {
    await db().prepare(`INSERT INTO document_requests (id,buyer_id,kind,details,draft,ack_company_status,ack_customer_status,created_at,updated_at,document_number)
      SELECT ?,NULL,?,?,json_set(?,'$.number',number),'not_requested','not_requested',?,?,number
      FROM (${automatic ? NEXT_DOCUMENT_NUMBER_SQL : "SELECT ? AS number"}) WHERE true ON CONFLICT(id) DO NOTHING`)
      .bind(id, body.kind, JSON.stringify({ contact, company }), JSON.stringify(draft), now, now, ...(automatic ? numberingParameters(body.kind, draft.number, id) : [draft.number])).run();
  } catch (error) { if (/UNIQUE/i.test(String(error))) throw new ApiError("Cette référence existe déjà pour ce type de document. Choisissez un autre numéro.", 409); throw error; }
  return summary(await findDocumentRequest(id));
}
export async function submitDocumentRequest(body: Record<string, unknown>, buyer: Buyer) {
  if (!isDocumentKind(body.kind)) throw new ApiError("Choisissez le document demandé.");
  const idem = textField(body.idempotencyKey, "La référence", 100);
  const id = "TZ-R-" + (await hash("document-request:" + buyer.id + ":" + body.kind + ":" + idem)).slice(0, 12).toUpperCase();
  const existing = await db().prepare("SELECT * FROM document_requests WHERE id=? AND buyer_id=?").bind(id, buyer.id).first<Row>();
  if (existing) return summary(existing);
  const contact = contactFields(body, buyer), company = (await readSettings()).company, now = Date.now();
  const draft = newDocumentDraft(id, body.kind, contact, company);
  await db().batch([db().prepare("INSERT OR IGNORE INTO document_requests (id,buyer_id,kind,details,draft,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(id, buyer.id, body.kind, JSON.stringify({ contact, company }), JSON.stringify(draft), now, now), ...(!buyer.city ? [db().prepare("UPDATE buyers SET city=? WHERE id=? AND city IS NULL").bind(contact.city, buyer.id)] : []), ...(!buyer.procurementType ? [db().prepare("UPDATE buyers SET procurement_type=? WHERE id=? AND procurement_type IS NULL").bind(contact.procurementType, buyer.id)] : [])]);
  const row = await findDocumentRequest(id, buyer.id), claim = crypto.randomUUID();
  const acquired = await db().prepare("UPDATE document_requests SET ack_claim=? WHERE id=? AND ack_claim IS NULL").bind(claim, id).run();
  if (acquired.meta.changes) {
    const stored = snapshot(row), request = summary(row), pdf = await createBusinessPdf(request, stored.company);
    const mail = documentEmails(id, request, stored.company);
    // The existing signed relay routes this administrative message to the
    // established administration inbox. Its accepted channel and ID format stay unchanged.
    const delivery = await notify(id, documentBuyer(contact, buyer.id), "remise", { company: stored.company }, 0, row.created_at, false, { mail, pdf });
    await db().prepare("UPDATE document_requests SET ack_company_status=?,ack_customer_status=? WHERE id=? AND ack_claim=?").bind(delivery.company, delivery.customer, id, claim).run();
  }
  return summary(await findDocumentRequest(id, buyer.id));
}
function validRevision(value: unknown) { if (!Number.isSafeInteger(value) || Number(value) < 1) throw new ApiError("Actualisez la demande avant de l’enregistrer.", 409); return Number(value); }
export function validateDocumentDraft(input: unknown, contact: DocumentContact, lockRecipient = true): DocumentDraft {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ApiError("Document invalide.");
  const data = input as Record<string, unknown>;
  const number = normalizeDocumentReference(textField(data.number, "Le numéro du document", 80));
  if (!parseDocumentReference(number)) throw new ApiError("Saisissez une référence au format TW 5/2026.");
  if (typeof data.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !Number.isFinite(Date.parse(data.date)) || new Date(data.date).toISOString().slice(0, 10) !== data.date) throw new ApiError("Saisissez une date valide.");
  if (typeof data.taxRate !== "number" || !Number.isFinite(data.taxRate) || data.taxRate < 0 || data.taxRate > 100 || Math.abs(data.taxRate * 100 - Math.round(data.taxRate * 100)) > 1e-6) throw new ApiError("Taux de TVA invalide.");
  if (!Array.isArray(data.items) || !data.items.length || data.items.length > 40) throw new ApiError("Ajoutez entre 1 et 40 lignes au document.");
  const items = data.items.map(item => {
    if (!item || typeof item !== "object") throw new ApiError("Article invalide.");
    if (typeof item.quantity !== "number" || !Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 100000 || Math.abs(item.quantity * 1000 - Math.round(item.quantity * 1000)) > 1e-5) throw new ApiError("Quantité invalide (trois décimales maximum).");
    if (typeof item.unitPrice !== "number" || !Number.isFinite(item.unitPrice) || item.unitPrice < 0 || item.unitPrice > 1e8 || Math.abs(item.unitPrice * 100 - Math.round(item.unitPrice * 100)) > 1e-5) throw new ApiError("Prix unitaire invalide en dirhams marocains (MAD).");
    return { designation: textField(item.designation, "La désignation de l’article", 4000), unit: textField(item.unit, "L’unité", 10), quantity: item.quantity, unitPrice: item.unitPrice };
  });
  const edited = data.contact && typeof data.contact === "object" ? contactFields(data.contact as Record<string, unknown>, undefined, true) : { ...contact, name: contact.maitreOuvrage, city: "", note: "" };
  if (lockRecipient && edited.email !== contact.email) throw new ApiError("Le document doit être envoyé à l’email enregistré dans la demande.");
  const result = { number, date: data.date, place: "", bank: data.bank ? textField(data.bank, "La banque", 200) : "", rib: data.rib ? textField(data.rib, "Le RIB", 60) : "", taxRate: data.taxRate, items, contact: edited, note: "", authority: data.authority ? textField(data.authority, "L’administration", 1000) : "", tenderReference: data.tenderReference ? textField(data.tenderReference, "L’appel d’offres", 100) : "", marketReference: data.marketReference ? textField(data.marketReference, "Le marché", 100) : "" };
  if (edited.procurementType === "marches" && (!result.authority || !result.tenderReference || !result.marketReference)) throw new ApiError("Renseignez l’administration, l’appel d’offres et le marché.");
  if (documentTotals(result).total > 1e10) throw new ApiError("Le total du document est trop élevé."); return result;
}
export async function saveDocumentDraft(body: Record<string, unknown>) {
  const row = await findDocumentRequest(body.id), draft = validateDocumentDraft(body.draft, snapshot(row).contact, !!row.buyer_id);
  if (!(body.autoNumber === true && !row.document_number)) await checkDocumentReference(row.kind, draft.number, row.id);
  let changed;
  try {
    const automatic = body.autoNumber === true && !row.document_number;
    changed = await db().prepare(`UPDATE document_requests SET (draft,document_number)=(SELECT json_set(?,'$.number',number),number FROM (${automatic ? NEXT_DOCUMENT_NUMBER_SQL : "SELECT ? AS number"})),revision=revision+1,updated_at=? WHERE id=? AND revision=? AND send_event IS NULL`)
      .bind(JSON.stringify(draft), ...(automatic ? numberingParameters(row.kind, draft.number, row.id) : [draft.number]), Date.now(), row.id, validRevision(body.revision)).run();
  } catch (error) { if (/UNIQUE/i.test(String(error))) throw new ApiError("Cette référence existe déjà pour ce type de document. Choisissez un autre numéro.", 409); throw error; }
  if (!changed.meta.changes) throw new ApiError("Le document a changé ou a déjà été préparé pour l’envoi. Actualisez la demande.", 409);
  return summary(await findDocumentRequest(row.id));
}
export async function previewDocument(body: Record<string, unknown>) {
  if (!body.id) {
    if (!isDocumentKind(body.kind)) throw new ApiError("Choisissez le document à créer.");
    const contact = contactFields((body.draft as DocumentDraft | undefined)?.contact || {}, undefined, true), draft = validateDocumentDraft(body.draft, contact, false), company = (await readSettings()).company, now = Date.now();
    const request: DocumentRequest = { id: "APERCU", kind: body.kind, origin: "admin", contact, draft, revision: 1, createdAt: now, updatedAt: now, status: "draft", hasPdf: false, locked: false, companyNotification: "not_requested", customerNotification: "not_requested", companyDelivery: null, customerDelivery: null };
    return createBusinessPdf(request, company, { requestId: request.id, kind: request.kind, draft, company, createdAt: now });
  }
  const row = await findDocumentRequest(body.id);
  const draft = validateDocumentDraft(body.draft, snapshot(row).contact, !!row.buyer_id), company = (await readSettings()).company;
  return createBusinessPdf(summary(row), company, { requestId: row.id, kind: row.kind, draft, company, createdAt: row.created_at });
}
export async function downloadDocument(id: unknown, buyerId?: string, receipt = false) {
  const row = await findDocumentRequest(id, buyerId);
  if (receipt) return createBusinessPdf(summary(row), snapshot(row).company);
  if (!row.pdf_key) throw new ApiError("Le document est en cours de préparation.", 404);
  return readDocumentBytes(row.pdf_key);
}
export async function sendDocument(body: Record<string, unknown>) {
  const row = await findDocumentRequest(body.id);
  if (body.confirmed !== true) throw new ApiError("Confirmez que vous avez vérifié le document et son destinataire.");
  if (row.send_status === "sent") return summary(row);
  const claim = crypto.randomUUID(), now = Date.now(), expected = validRevision(body.revision);
  if (row.revision !== expected) throw new ApiError("Le document a changé. Actualisez avant l’envoi.", 409);
  if (row.send_status === "pending" && now - row.updated_at < 120000) throw new ApiError("Un envoi est déjà en cours. Actualisez dans un instant.", 409);
  let eventId = row.send_event, pdfKey = row.pdf_key, issued: IssuedDocument;
  if (!eventId) {
    const company = (await readSettings()).company, draft = validateDocumentDraft(JSON.parse(row.draft), snapshot(row).contact, !!row.buyer_id);
    issued = { requestId: row.id, kind: row.kind, draft, company, createdAt: now };
    eventId = "TZ-R-" + (await hash("issued-document:" + row.id + ":" + row.revision)).slice(0, 12).toUpperCase();
    pdfKey = "documents/" + row.id + "/" + eventId + ".pdf";
    try {
      const changed = await db().prepare("UPDATE document_requests SET send_event=?,send_claim=?,send_status='pending',issued=?,document_number=?,updated_at=? WHERE id=? AND revision=? AND send_event IS NULL").bind(eventId, claim, JSON.stringify(issued), draft.number, now, row.id, expected).run();
      if (!changed.meta.changes) throw new ApiError("Un autre envoi ou une modification a commencé. Actualisez la demande.", 409);
    } catch (error) { if (error instanceof ApiError) throw error; if (/UNIQUE/i.test(String(error))) throw new ApiError("Ce numéro a déjà été utilisé pour ce type de document.", 409); throw error; }
  } else {
    if (!row.issued) throw new Error("Issued document snapshot unavailable");
    pdfKey ||= "documents/" + row.id + "/" + eventId + ".pdf";
    issued = JSON.parse(row.issued);
    const changed = await db().prepare("UPDATE document_requests SET send_claim=?,send_status='pending',updated_at=? WHERE id=? AND send_event=? AND (send_status='failed' OR (send_status='pending' AND updated_at<?))").bind(claim, now, row.id, eventId, now - 120000).run();
    if (!changed.meta.changes) throw new ApiError("Un autre envoi est déjà en cours. Actualisez la demande.", 409);
  }
  try {
    // Claim the immutable document before generating its PDF, so a competing
    // request cannot generate or send a second copy. Recover a stored PDF even
    // if an earlier request stopped between saving it and updating its record.
    let pdf: Uint8Array | null = await findDocumentBytes(pdfKey!);
    if (!pdf) {
      pdf = await createBusinessPdf(summary(row), issued.company, issued);
      await saveDocumentBytes(pdfKey!, pdf);
    }
    await db().prepare("UPDATE document_requests SET pdf_key=? WHERE id=? AND send_claim=?").bind(pdfKey, row.id, claim).run();
    const mail = documentEmails(eventId!, summary(row), issued.company, issued);
    const delivery = await notify(eventId!, documentBuyer(issued.draft.contact, row.buyer_id || row.id), "remise", { company: issued.company }, 0, issued.createdAt, false, { mail, pdf });
    await db().prepare("UPDATE document_requests SET send_status=?,company_delivery=?,customer_delivery=?,company_error=?,customer_error=?,updated_at=? WHERE id=? AND send_claim=?").bind(delivery.customer === "sent" ? "sent" : "failed", delivery.company, delivery.customer, delivery.companyError || null, delivery.customerError || null, Date.now(), row.id, claim).run();
  } catch (error) { await db().prepare("UPDATE document_requests SET send_status='failed',updated_at=? WHERE id=? AND send_claim=?").bind(Date.now(), row.id, claim).run(); throw error; }
  return summary(await findDocumentRequest(row.id));
}
