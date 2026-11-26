import type { Buyer } from "@/lib/catalog";
import type { Company } from "@/lib/company";
import type { ProcurementType } from "@/lib/procurement";
import { formatDocumentReference } from "@/lib/document-reference";

const BUYER_DOCUMENT_TYPES = { facture: "Facture", livraison: "Bon de livraison", echantillons: "Bon de livraison des échantillons" } as const;
const STATEMENT_DOCUMENT_TYPES = {
  declaration: "Déclaration sur l’honneur",
  engagement: "Acte d’engagement",
  garantie: "Attestation de garantie",
} as const;
export const DOCUMENT_TYPES = { ...BUYER_DOCUMENT_TYPES, ...STATEMENT_DOCUMENT_TYPES };
export function isBuyerDocumentKind(value: unknown): value is keyof typeof BUYER_DOCUMENT_TYPES {
  return typeof value === "string" && Object.hasOwn(BUYER_DOCUMENT_TYPES, value);
}
export function isStatementDocument(kind: DocumentKind) { return Object.hasOwn(STATEMENT_DOCUMENT_TYPES, kind); }
export type DocumentKind = keyof typeof DOCUMENT_TYPES;
export type DocumentContact = { name: string; maitreOuvrage: string; reference: string; devisReference: string; objet: string; phone: string; email: string; city: string; procurementType: ProcurementType; note: string };
export type DocumentLine = { designation: string; unit: string; quantity: number; unitPrice: number };
export type DocumentDraft = { number: string; date: string; place: string; bank: string; rib: string; taxRate: number; items: DocumentLine[]; note: string; contact: DocumentContact; authority?: string; tenderReference?: string; marketReference?: string; statement?: string };
export type DocumentRequest = { id: string; kind: DocumentKind; origin?: "customer" | "admin"; contact: DocumentContact; createdAt: number; updatedAt: number; revision: number; draft: DocumentDraft; numberAssigned?: boolean; status: "new" | "draft" | "pending" | "failed" | "sent"; companyNotification: string; customerNotification: string; hasPdf: boolean; locked: boolean; companyDelivery: string | null; customerDelivery: string | null; companyError?: string | null; customerError?: string | null };
export type IssuedDocument = { requestId: string; kind: DocumentKind; draft: DocumentDraft; company: Company; createdAt: number };
export function isDocumentKind(value: unknown): value is DocumentKind { return typeof value === "string" && Object.hasOwn(DOCUMENT_TYPES, value); }
export function documentLabel(kind: DocumentKind) { return DOCUMENT_TYPES[kind]; }
export function documentBuyer(contact: DocumentContact, id: string): Buyer { return { id, name: contact.name, phone: contact.phone, email: contact.email, city: contact.city || null, maitreOuvrage: contact.maitreOuvrage, procurementType: contact.procurementType }; }
export function documentTotals(draft: DocumentDraft) {
  const subtotalCents = draft.items.reduce((sum, item) => sum + Math.round(Math.round(item.unitPrice * 100) * item.quantity), 0);
  const taxCents = Math.round(subtotalCents * draft.taxRate / 100);
  return { subtotal: subtotalCents / 100, tax: taxCents / 100, total: (subtotalCents + taxCents) / 100 };
}
export function newDocumentDraft(id: string, kind: DocumentKind, contact: DocumentContact, company: Company): DocumentDraft {
  const year = new Date().getUTCFullYear();
  return { number: formatDocumentReference(1, year), date: new Date().toISOString().slice(0, 10), place: "", bank: "BANQUE CENTRALE POPULAIRE AGENCE AL BASATINE BOUZNIKA", rib: company.rib, taxRate: 20, items: isStatementDocument(kind) ? [] : [{ designation: "", unit: "U", quantity: 1, unitPrice: 0 }], note: "", contact: { ...contact, note: "" } };
}
export function requestStatus(request: Pick<DocumentRequest, "hasPdf" | "status">) { return request.hasPdf ? "Document disponible" : request.status === "new" ? "Demande enregistrée" : "En cours de traitement"; }

export function amountInWords(value: number) {
  const ones = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize"];
  function integer(n: number): string {
    if (n < 17) return ones[n];
    if (n < 20) return "dix-" + ones[n - 10];
    if (n < 70) { const tens = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"][Math.floor(n / 10)], rest = n % 10; return tens + (rest === 1 ? " et un" : rest ? "-" + integer(rest) : ""); }
    if (n < 80) return "soixante" + (n === 71 ? " et onze" : "-" + integer(n - 60));
    if (n < 100) return "quatre-vingt" + (n === 80 ? "s" : "-" + integer(n - 80));
    if (n < 1000) { const hundreds = Math.floor(n / 100), rest = n % 100; return (hundreds > 1 ? ones[hundreds] + " " : "") + "cent" + (hundreds > 1 && !rest ? "s" : "") + (rest ? " " + integer(rest) : ""); }
    for (const [amount, label] of [[1e9, "milliard"], [1e6, "million"], [1e3, "mille"]] as const) if (n >= amount) { const multiple = Math.floor(n / amount), rest = n % amount; return (amount === 1e3 && multiple === 1 ? "" : integer(multiple).replace(/vingts$/, "vingt").replace(/cents$/, "cent") + " ") + label + (amount !== 1e3 && multiple > 1 ? "s" : "") + (rest ? " " + integer(rest) : ""); }
    return "";
  }
  const cents = Math.round(value * 100), whole = Math.floor(cents / 100), rest = cents % 100;
  const text = integer(whole) + (whole > 1 ? " dirhams" : " dirham") + (rest ? " et " + integer(rest) + (rest > 1 ? " centimes" : " centime") : "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
