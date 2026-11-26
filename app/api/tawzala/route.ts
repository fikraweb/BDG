import { ApiError, db, config, hash, equal, session, sessionCookie, textField, phoneField, cityField, emailField, procurementField, notify } from "@/lib/server";
import { calculateRemise } from "@/lib/catalog";
import { changeAccountPassword, hasBuyerAccount, registerAccount, signInAccount } from "@/lib/accounts";
import { createOrderPdf } from "@/lib/order-pdf";
import { readSettings } from "@/lib/site-store";
import { verifyGatePassword } from "@/lib/security";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
function json(value: unknown, status = 200, extra: Record<string, string> = {}) { return Response.json(value, { status, headers: { "Cache-Control": "no-store", ...extra } }); }
function failure(error: unknown) { if (error instanceof ApiError) return json({ error: error.message }, error.status); console.error("TAWZALA request failed", error instanceof Error ? error.message : "unknown"); return json({ error: "Votre espace est momentanément indisponible. Réessayez dans un instant." }, 503); }
type OrderRow = { id: string; kind: "remise" | "furniture"; details: string; total_cents: number; created_at: number };
const pdfUrl = (id: string) => "/api/tawzala?pdf=" + encodeURIComponent(id);

export async function GET(request: Request) {
  const downloadId = new URL(request.url).searchParams.get("pdf");
  try {
    const { buyer } = await session(request, downloadId !== null);
    if (downloadId !== null) {
      if (!/^[A-Za-z0-9-]{1,100}$/.test(downloadId)) throw new ApiError("Document introuvable.", 404);
      const order = await db().prepare("SELECT id,kind,details,total_cents,created_at FROM orders WHERE id=? AND buyer_id=?").bind(downloadId,buyer!.id).first<OrderRow>();
      if (!order) throw new ApiError("Document introuvable.", 404);
      const bytes = await createOrderPdf({ id: order.id, kind: order.kind, buyer: buyer!, details: JSON.parse(order.details), total: order.total_cents / 100, createdAt: order.created_at });
      return new Response(bytes.slice().buffer as ArrayBuffer, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${order.id}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
    }
    const store = { settings: await readSettings(), products: [] };
    return json({ authenticated: true, buyer, hasAccount: buyer ? await hasBuyerAccount(buyer.id) : false, store, isAdmin: await isAdmin(request) });
  } catch (error) { if (downloadId === null && error instanceof ApiError && error.status === 401) {
    try { return json({ authenticated: false, buyer: null, cart: [], hasAccount: false, store: { settings: await readSettings(), products: [] }, isAdmin: await isAdmin(request) }); } catch (error) { return failure(error); }
  } return failure(error); }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin && origin !== config("SITE_ORIGIN")) throw new ApiError("Origine de la requête invalide.", 403);
    if (!(request.headers.get("content-type") || "").startsWith("application/json")) throw new ApiError("Requête invalide.");
    const raw = await request.text(); if (raw.length > 20000) throw new ApiError("La demande est trop longue.");
    let body: Record<string, unknown>; try { body = JSON.parse(raw); } catch { throw new ApiError("Requête invalide."); }
    if (!body || Array.isArray(body)) throw new ApiError("Requête invalide.");
    const action = body.action;
    if (["begin-visit", "end-visit", "logout", "account-logout"].includes(String(action))) {
      const oldToken = request.headers.get("cookie")?.split(";").map(value => value.trim()).find(value => value.startsWith("tawzala_session="))?.slice(16);
      if (oldToken && /^[a-f0-9]{64}$/.test(oldToken)) await db().prepare("DELETE FROM sessions WHERE token_hash=?").bind(await hash(oldToken)).run();
      return json({ ok: true, authenticated: false, buyer: null, hasAccount: false, cart: [], next: "/" }, 200, { "Set-Cookie": sessionCookie("", request, true) });
    }
    if (action === "login") {
      const key = await hash(request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "local");
      const now = Date.now();
      const attempt = await db().prepare("SELECT count, window_start FROM login_attempts WHERE key=?").bind(key).first<{ count: number; window_start: number }>();
      if (attempt && now - attempt.window_start < 900000 && attempt.count >= 5) throw new ApiError("Trop de tentatives. Réessayez dans 15 minutes.", 429);
      const password = typeof body.password === "string" && body.password.length <= 128 ? body.password : "";
      if (!await verifyGatePassword(password)) {
        await db().prepare("INSERT INTO login_attempts (key,count,window_start) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN ?>window_start+900000 THEN 1 ELSE count+1 END, window_start=CASE WHEN ?>window_start+900000 THEN ? ELSE window_start END").bind(key, now, now, now, now).run();
        throw new ApiError("Mot de passe incorrect. Vérifiez votre code d’accès.", 401);
      }
      await db().prepare("DELETE FROM login_attempts WHERE key=?").bind(key).run();
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, "0")).join("");
      const oldToken = request.headers.get("cookie")?.split(";").map(value => value.trim()).find(value => value.startsWith("tawzala_session="))?.slice(16);
      await db().batch([db().prepare("INSERT INTO sessions (token_hash,expires_at) VALUES (?,?)").bind(await hash(token), now + 86400000), ...(oldToken && /^[a-f0-9]{64}$/.test(oldToken) ? [db().prepare("DELETE FROM sessions WHERE token_hash=?").bind(await hash(oldToken))] : [])]);
      return json({ buyer: null, hasAccount: false, cart: [], next: "/inscription?mode=connexion" }, 200, { "Set-Cookie": sessionCookie(token, request) });
    }
    const current = await session(request);
    if (action === "register" || action === "account-login" || action === "account-password") {
      const result = action === "register" ? await registerAccount(body, current) : action === "account-password" ? await changeAccountPassword(request,body,current) : await signInAccount(request, body, current);
      const { token, ...reply } = result;
      return json({ ...reply, store: { settings: await readSettings(), products: [] } }, 200, { "Set-Cookie": sessionCookie(token, request) });
    }
    if (!current.buyer) throw new ApiError("Complétez votre inscription pour continuer.", 403);
    const buyer = current.buyer;
    if (action !== "remise") throw new ApiError("Action inconnue.");
    const idem = textField(body.idempotencyKey,"La référence",100);
    const orderId = "TZ-R-" + (await hash(buyer.id + ":" + idem)).slice(0,12).toUpperCase();
    const existing = await db().prepare("SELECT id,details,total_cents FROM orders WHERE id=? AND buyer_id=?").bind(orderId,buyer.id).first<{ id: string; details: string; total_cents: number }>();
    if (existing) {
      const delivery = await db().prepare("SELECT status,customer_status FROM notifications WHERE order_id=?").bind(orderId).first<{ status: string; customer_status: string }>();
      const summary=JSON.parse(existing.details);
      return json({ orderId, saved: true, notification: delivery?.status, customerNotification: delivery?.customer_status, summary, total: existing.total_cents / 100, pdfUrl: pdfUrl(orderId) });
    }
    const settings = await readSettings();
    if(body.paymentMethod!=="cashplus"&&body.paymentMethod!=="wafacash")throw new ApiError("Choisissez Cash Plus ou Wafacash pour recevoir votre remise d’achat.");
    const procurementType = procurementField(body.procurementType ?? buyer.procurementType);
    const phone = phoneField(body.phone), maitreOuvrage = textField(body.maitreOuvrage,"Le maître d’ouvrage",200);
    const devisReference = textField(body.devisReference,"Le numéro / la référence du devis",100);
    const objet = textField(body.objet,"L’objet de la prestation",1000);
    const email = emailField(body.email);
    const clientCity = cityField(body.clientCity ?? buyer.city);
    const note = "";
    if (body.source !== undefined && body.source !== "manual") throw new ApiError("Source du calcul invalide.");
    if (typeof body.amount !== "number") throw new ApiError("Montant invalide.");
    let result;
    try { result = calculateRemise(body.amount, settings.remiseRate); }
    catch (error) { throw new ApiError((error as Error).message); }
    const total = result.net;
    const details = { ...result, source: "manual", phone, maitreOuvrage, note, procurementType, devisReference, objet, email, clientCity, company: settings.company, paymentMethod: body.paymentMethod, paymentDeadlineHours: 24, documentVersion: 2 };
    if (body.expectedQuote !== undefined) {
      const quote = body.expectedQuote as Record<string, unknown> | null;
      const keys = ["amount", "rate", "discount", "net"] as const;
      if (!quote || typeof quote !== "object" || keys.some(key => quote[key] !== details[key])) throw new ApiError("Le taux de remise a changé. Actualisez les montants avant de valider.", 409);
    }
    const createdAt = Date.now();
    await db().batch([db().prepare("INSERT OR IGNORE INTO orders (id,buyer_id,kind,details,total_cents,idempotency_key,created_at) VALUES (?,?,?,?,?,?,?)").bind(orderId,buyer.id,action,JSON.stringify(details),Math.round(total*100),idem,createdAt),db().prepare("INSERT OR IGNORE INTO notifications (order_id,status,customer_status,updated_at) VALUES (?,'pending_configuration','pending_configuration',?)").bind(orderId,createdAt),...(!buyer.procurementType ? [db().prepare("UPDATE buyers SET procurement_type=? WHERE id=? AND procurement_type IS NULL").bind(procurementType,buyer.id)] : []),...(!buyer.city ? [db().prepare("UPDATE buyers SET city=? WHERE id=? AND city IS NULL").bind(clientCity,buyer.id)] : [])]);
    // Use the saved snapshot for both the receipt and attachment, including retries.
    const saved = await db().prepare("SELECT id,kind,details,total_cents,created_at FROM orders WHERE id=? AND buyer_id=?").bind(orderId,buyer.id).first<OrderRow>();
    if (!saved) throw new Error("Saved order unavailable");
    const summary = JSON.parse(saved.details) as Record<string, unknown>;
    const savedTotal = saved.total_cents / 100;
    const notification = await notify(orderId,buyer,action,summary,savedTotal,saved.created_at);
    return json({ orderId, saved: true, notification: notification.company, customerNotification: notification.customer, buyer: { ...buyer, city: buyer.city || clientCity, procurementType: buyer.procurementType || procurementType }, summary, total: savedTotal, pdfUrl: pdfUrl(orderId) });
  } catch (error) { return failure(error); }
}
