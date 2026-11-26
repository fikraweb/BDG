import { isProcurementType } from "@/lib/procurement";
import { cartKey, productSize } from "@/lib/catalog";
import { env } from "cloudflare:workers";
import { type Product, type CartLine, type Buyer } from "@/lib/catalog";
import { createOrderPdf, bytesToBase64 } from "@/lib/order-pdf";
import { orderEmails } from "@/lib/order-email";

export function db(): D1Database { if (!env.DB) throw new Error("Storage unavailable"); return env.DB; }
export function config(name: string): string { return String((env as unknown as Record<string, unknown>)[name] || process.env[name] || ""); }
export async function hash(value: string) { const data = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return Array.from(new Uint8Array(data), x => x.toString(16).padStart(2, "0")).join(""); }
export function equal(a: string, b: string) { let diff = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return diff === 0; }
export class ApiError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function textField(value: unknown, label: string, max = 160) { if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new ApiError(label + " est obligatoire."); return value.trim(); }
export function cityField(value: unknown) { return textField(value, "La ville", 120).replace(/\s+/g, " "); }
export function phoneField(value: unknown) { const phone = textField(value, "Le téléphone", 30); if (!/^\+?[\d\s().-]{8,25}$/.test(phone) || phone.replace(/\D/g, "").length < 8) throw new ApiError("Vérifiez votre numéro de téléphone."); return phone; }
export function emailField(value: unknown) { const email = textField(value, "L’email", 254).toLowerCase(); if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)) throw new ApiError("Vérifiez votre adresse email."); return email; }
export function procurementField(value: unknown) { if (!isProcurementType(value)) throw new ApiError("Choisissez « Bon de commande » ou « Marchés » pour votre cadre d’achat."); return value; }
export async function session(request: Request, requireBuyer = false) {
  const token = request.headers.get("cookie")?.split(";").map(x => x.trim()).find(x => x.startsWith("tawzala_session="))?.slice(16);
  if (!token || token.length !== 64) throw new ApiError("Veuillez accéder à votre espace avec le mot de passe.", 401);
  const tokenHash = await hash(token);
  const row = await db().prepare("SELECT s.token_hash, s.buyer_id, b.name, b.phone, b.email, b.maitre_ouvrage, b.city, b.procurement_type FROM sessions s LEFT JOIN buyers b ON b.id=s.buyer_id WHERE s.token_hash=? AND s.expires_at>?").bind(tokenHash, Date.now()).first<{ token_hash: string; buyer_id: string | null; name: string | null; phone: string | null; email: string | null; maitre_ouvrage: string | null; city: string | null; procurement_type: Buyer["procurementType"] }>();
  if (!row) throw new ApiError("Votre session a expiré. Veuillez vous reconnecter.", 401);
  const buyer: Buyer | null = row.buyer_id ? { id: row.buyer_id, name: row.name!, phone: row.phone!, email: row.email!, maitreOuvrage: row.maitre_ouvrage, city: row.city, procurementType: row.procurement_type } : null;
  if (requireBuyer && !buyer) throw new ApiError("Complétez votre inscription pour continuer.", 403);
  return { tokenHash, buyer };
}
export function sessionCookie(token: string, request: Request, clear = false) {
  const secure = new URL(request.url).protocol === "https:";
  // Private Sites can be opened inside ChatGPT. Partition the HTTPS cookie so
  // that the browser keeps the session in that embedded context as well.
  return "tawzala_session=" + token + "; Path=/; HttpOnly" + (clear ? "; Max-Age=0" : "") + (secure ? "; SameSite=None; Secure; Partitioned" : "; SameSite=Lax");
}
export function normalizedCart(input: unknown, catalogue: Product[]): CartLine[] {
  if (!Array.isArray(input) || input.length > 200) throw new ApiError("Panier invalide.");
  const seen = new Set<string>();
  return input.map(line => {
    if (!line || typeof line.productId !== "string" || (line.sizeId !== undefined && typeof line.sizeId !== "string") || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 100) throw new ApiError("Quantité ou produit invalide. Actualisez votre catalogue.");
    const product=catalogue.find(p=>p.id===line.productId);
    if (!product) throw new ApiError("Produit indisponible. Actualisez votre catalogue.");
    let size; try { size=productSize(product,line.sizeId,line.customDimensions); } catch (e) { throw new ApiError((e as Error).message); }
    const result={productId:product.id,quantity:line.quantity,...(line.customDimensions&&size?{customDimensions:{lengthCm:size.lengthCm,depthCm:size.depthCm,heightCm:size.heightCm}}:size?{sizeId:size.id}:{})};
    const key=cartKey(result); if(seen.has(key)) throw new ApiError("Cette dimension figure déjà dans le panier."); seen.add(key); return result;
  });
}
export type NotificationStatus = "sent" | "failed" | "pending_configuration" | "not_requested";
export type NotificationResult = { company: NotificationStatus; customer: NotificationStatus; companyError?: string; customerError?: string };
type Delivery = { status: NotificationStatus; id?: string; code?: string };
export async function notify(orderId: string, buyer: Buyer, kind: "remise" | "furniture", details: Record<string, unknown>, total: number, createdAt: number, persistNotification = true, document?: { mail: ReturnType<typeof orderEmails>; pdf: Uint8Array }): Promise<NotificationResult> {
  const to = config(kind === "remise" ? "NOTIFICATION_EMAIL_REMISE" : "NOTIFICATION_EMAIL_MOBILIER");
  const gmailUrl = config("GMAIL_RELAY_URL"), gmailSecret = config("GMAIL_RELAY_SECRET");
  const key = config("RESEND_API_KEY"), from = config("EMAIL_FROM"), useGmail = !!gmailUrl;
  if (!to || (useGmail ? !gmailSecret : !key || !from)) return { company: "pending_configuration", customer: "pending_configuration", companyError: "not_configured", customerError: "not_configured" };
  const mail = document?.mail ?? orderEmails(orderId, buyer, kind, details, total, createdAt);
  let company: Delivery = { status: "failed", code: "not_confirmed" };
  let customer: Delivery = { status: "failed", code: "not_confirmed" };
  try {
    const pdfDetails = kind === "remise" ? {...details,items:undefined,photos:undefined,documentVersion:2} : details;
    const pdf = document?.pdf ?? await createOrderPdf({ id: orderId, buyer, kind, details:pdfDetails, total, createdAt });
    const attachment = { filename: orderId + ".pdf", content: bytesToBase64(pdf) };
    if (useGmail) {
      if (pdf.length > 4194304) throw new Error("pdf_too_large");
      if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,200}\/exec$/.test(gmailUrl)) throw new Error("Invalid Gmail relay URL");
      const payload = JSON.stringify({ orderId, kind, to, replyTo: mail.contactEmail, subject: mail.company.subject, body: mail.company.body, pdf: attachment, confirmation: { to: mail.contactEmail, subject: mail.customer.subject, body: mail.customer.body } });
      const timestamp = Date.now();
      const signingKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(gmailSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const signed = await crypto.subtle.sign("HMAC", signingKey, new TextEncoder().encode(timestamp + "." + payload));
      const signature = Array.from(new Uint8Array(signed), byte => byte.toString(16).padStart(2, "0")).join("");
      const deadline = Date.now() + 28000;
      const safeCode = (code: unknown) => typeof code === "string" && /^[a-z_]{1,40}$/.test(code) ? code : "not_confirmed";
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const remaining = deadline - Date.now();
          if (remaining <= 0) break;
          const signal = AbortSignal.timeout(Math.min(remaining, attempt ? remaining : 18000));
          // A retry keeps the signed payload and delivery identifier. The relay
          // deduplicates recipients independently if its first reply was lost.
          let response = await fetch(gmailUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: 1, timestamp, payload, signature }), redirect: "manual", signal });
          if ([301, 302, 303].includes(response.status)) {
            const location = response.headers.get("location");
            if (!location) throw new Error("provider_unavailable");
            const target = new URL(location);
            if (target.protocol !== "https:" || target.hostname !== "script.googleusercontent.com" || target.port || target.username || target.password || target.pathname !== "/macros/echo") throw new Error("provider_unavailable");
            response = await fetch(target.href, { method: "GET", redirect: "manual", signal });
          }
          if (!response.ok) throw new Error("provider_unavailable");
          const result = await response.json() as { version?: number; ok?: boolean; id?: string; code?: string; company?: Delivery; customer?: Delivery };
          const delivery = (value: Delivery | undefined, expectedId: string): Delivery => value?.status === "sent" && value.id === expectedId ? { status: "sent", id: expectedId } : { status: "failed", code: safeCode(value?.code || result.code) };
          if (result.version === 2) {
            if (company.status !== "sent") company = delivery(result.company, "gmail:" + orderId);
            if (customer.status !== "sent") customer = delivery(result.customer, "gmail:" + orderId + ":customer");
          } else if (result.ok === true && result.id === "gmail:" + orderId) {
            company = { status: "sent", id: result.id };
            if (customer.status !== "sent") customer = { status: "pending_configuration", code: "requires_v2" };
          } else { if (company.status !== "sent") company = { status: "failed", code: safeCode(result.code) }; if (customer.status !== "sent") customer = { status: "failed", code: safeCode(result.code) }; }
        } catch (error) {
          const name = error instanceof Error ? error.name : "";
          const code = name === "TimeoutError" || name === "AbortError" ? "timeout" : error instanceof Error && error.message === "provider_unavailable" ? "provider_unavailable" : "transport";
          if (company.status !== "sent") company = { status: "failed", code };
          if (customer.status !== "sent") customer = { status: "failed", code };
        }
        if (![company, customer].some(value => value.status === "failed" && ["busy", "transport", "timeout", "provider_unavailable"].includes(value.code || ""))) break;
      }
    } else {
      for (const audience of ["company", "customer"] as const) {
        try {
          const message = audience === "company" ? mail.company : mail.customer;
          const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", "Idempotency-Key": "bdg/" + orderId + (audience === "company" ? "" : "/customer") }, body: JSON.stringify({ from, to: [audience === "company" ? to : mail.contactEmail], reply_to: audience === "company" ? mail.contactEmail : to, subject: message.subject, text: message.body, attachments: [attachment] }), signal: AbortSignal.timeout(10000) });
          if (!response.ok) throw new Error("Email provider unavailable");
          const result = await response.json() as { id?: string };
          if (!result.id) throw new Error("Email provider did not confirm delivery");
          const accepted: Delivery = { status: "sent", id: result.id };
          if (audience === "company") company = accepted; else customer = accepted;
        } catch { const failed: Delivery = { status: "failed", code: "provider_unavailable" }; if (audience === "company") company = failed; else customer = failed; }
      }
    }
  } catch (error) { company = customer = { status: "failed", code: error instanceof Error && error.message === "pdf_too_large" ? "pdf_too_large" : "transport" }; }
  if(persistNotification) await db().prepare("UPDATE notifications SET status=?,provider_id=?,last_error=?,customer_status=?,customer_provider_id=?,customer_last_error=?,updated_at=? WHERE order_id=?").bind(company.status, company.id || null, company.status === "sent" ? null : company.code || "Email delivery unavailable", customer.status, customer.id || null, customer.status === "sent" ? null : customer.code || "Email delivery unavailable", Date.now(), orderId).run();
  if (company.status !== "sent" || customer.status !== "sent") console.warn("TAWZALA email delivery", { orderId, company: company.status, companyCode: company.code, customer: customer.status, customerCode: customer.code });
  return { company: company.status, customer: customer.status, ...(company.status !== "sent" ? { companyError: company.code } : {}), ...(customer.status !== "sent" ? { customerError: customer.code } : {}) };
}
