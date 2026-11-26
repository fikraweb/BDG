import { notifyRegistration } from "@/lib/registration-email";
import { ApiError, config, db, emailField, equal, hash, normalizedCart, phoneField, procurementField, session, textField, cityField } from "@/lib/server";
import { type Buyer } from "@/lib/catalog";

const WINDOW_MS = 15 * 60 * 1000;
const ITERATIONS = 100000;
const DUMMY_HASH = "pbkdf2-sha256$100000$00000000000000000000000000000000$" + "0".repeat(64);
type CurrentSession = Awaited<ReturnType<typeof session>>;

function hex(value: ArrayBuffer) {
  return Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, "0")).join("");
}
async function passwordDigest(password: string, saltHex: string) {
  const pepper = config("ACCOUNT_PASSWORD_PEPPER");
  if (pepper.length < 32) throw new Error("Account password secret unavailable");
  const hmacKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const peppered = await crypto.subtle.sign("HMAC", hmacKey, new TextEncoder().encode(password));
  const key = await crypto.subtle.importKey("raw", peppered, "PBKDF2", false, ["deriveBits"]);
  const salt = Uint8Array.from(saltHex.match(/../g)!, pair => parseInt(pair, 16));
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", iterations: ITERATIONS, salt }, key, 256));
}
export async function encodePassword(password: string) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  return "pbkdf2-sha256$100000$" + salt + "$" + await passwordDigest(password, salt);
}
export async function verifyPassword(password: string, encoded: string | null) {
  const match = (encoded || DUMMY_HASH).match(/^pbkdf2-sha256\$100000\$([0-9a-f]{32})\$([0-9a-f]{64})$/);
  if (!match) throw new Error("Account password format unavailable");
  const digest = await passwordDigest(password, match[1]);
  return equal(digest, match[2]) && encoded !== null;
}
function registrationPassword(body: Record<string, unknown>) {
  if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128) {
    throw new ApiError("Choisissez un mot de passe de 8 à 128 caractères.");
  }
  if (body.confirmPassword !== body.password) throw new ApiError("Les deux mots de passe ne correspondent pas.");
  return body.password;
}
function token() { return hex(crypto.getRandomValues(new Uint8Array(32)).buffer); }

export async function hasBuyerAccount(buyerId: string) {
  return !!await db().prepare("SELECT buyer_id FROM buyer_credentials WHERE buyer_id=?").bind(buyerId).first();
}
async function rateKeys(request: Request, email: string, scope="account") {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-tawzala-client-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  return [await hash(scope+"-ip:" + ip), await hash(scope+"-email:" + email)];
}
async function enforceRateLimit(keys: string[]) {
  for (const key of keys) {
    const row = await db().prepare("SELECT count,window_start FROM login_attempts WHERE key=?").bind(key).first<{ count: number; window_start: number }>();
    if (row && Date.now() - row.window_start < WINDOW_MS && row.count >= 5) {
      throw new ApiError("Trop de tentatives. Réessayez dans 15 minutes.", 429);
    }
  }
}
async function recordFailure(keys: string[]) {
  const now = Date.now();
  await db().batch(keys.map(key => db().prepare("INSERT INTO login_attempts (key,count,window_start) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN ?>window_start+900000 THEN 1 ELSE count+1 END, window_start=CASE WHEN ?>window_start+900000 THEN ? ELSE window_start END").bind(key, now, now, now, now)));
}
async function rotateSession(current: CurrentSession, buyerId: string, newToken: string) {
  return [
    db().prepare("INSERT INTO sessions (token_hash,buyer_id,expires_at) VALUES (?,?,?)").bind(await hash(newToken), buyerId, Date.now() + 86400000),
    db().prepare("DELETE FROM sessions WHERE token_hash=?").bind(current.tokenHash),
  ];
}

export async function registerAccount(body: Record<string, unknown>, current: CurrentSession) {
  const password = registrationPassword(body);
  const email = emailField(body.email);
  const maitreOuvrage = textField(body.maitreOuvrage, "Le maître d’ouvrage", 200);
  const city = cityField(body.city);
  const procurementType = procurementField(body.procurementType);
  if (current.buyer && email !== current.buyer.email.toLowerCase()) throw new ApiError("Utilisez l’email de votre inscription actuelle.");
  const existing = await db().prepare("SELECT buyer_id FROM buyer_credentials WHERE email=?").bind(email).first();
  if (existing || (current.buyer && await hasBuyerAccount(current.buyer.id))) {
    throw new ApiError("Ce compte existe déjà. Utilisez « Se connecter ».", 409);
  }
  const buyer: Buyer = current.buyer ? { ...current.buyer, maitreOuvrage, city, procurementType } : { id: crypto.randomUUID(), name: textField(body.name, "Le nom", 100), phone: phoneField(body.phone), email, maitreOuvrage, city, procurementType };
  const encoded = await encodePassword(password);
  const newToken = token();
  const statements = [
    current.buyer
      ? db().prepare("UPDATE buyers SET maitre_ouvrage=?,city=?,procurement_type=? WHERE id=?").bind(maitreOuvrage, city, procurementType, buyer.id)
      : db().prepare("INSERT INTO buyers (id,name,phone,email,maitre_ouvrage,city,procurement_type,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(buyer.id, buyer.name, buyer.phone, email, maitreOuvrage, city, procurementType, Date.now()),
    db().prepare("INSERT INTO buyer_credentials (buyer_id,email,password_hash,created_at) VALUES (?,?,?,?)").bind(buyer.id, email, encoded, Date.now()),
    ...await rotateSession(current, buyer.id, newToken),
  ];
  try { await db().batch(statements); } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed: buyer_credentials\.(email|buyer_id)/.test(error.message)) {
      throw new ApiError("Ce compte existe déjà. Utilisez « Se connecter ».", 409);
    }
    throw error;
  }
  const registrationNotification = await notifyRegistration(buyer);
  return { buyer, hasAccount: true, registrationNotification, next: "/marches-publics", token: newToken };
}

export async function signInAccount(request: Request, body: Record<string, unknown>, current: CurrentSession) {
  const email = emailField(body.email);
  const keys = await rateKeys(request, email);
  await enforceRateLimit(keys);
  const row = await db().prepare("SELECT c.password_hash,b.id,b.name,b.phone,b.email,b.maitre_ouvrage,b.city,b.procurement_type FROM buyer_credentials c JOIN buyers b ON b.id=c.buyer_id WHERE c.email=?").bind(email).first<{ password_hash: string; id: string; name: string; phone: string; email: string; maitre_ouvrage: string | null; city: string | null; procurement_type: Buyer["procurementType"] }>();
  const password = typeof body.password === "string" && body.password.length <= 128 ? body.password : "";
  const valid = await verifyPassword(password, row?.password_hash || null);
  if (!valid || !row) {
    await recordFailure(keys);
    throw new ApiError("Email ou mot de passe incorrect.", 401);
  }
  const buyer: Buyer = { id: row.id, name: row.name, phone: row.phone, email: row.email, maitreOuvrage: row.maitre_ouvrage, city: row.city, procurementType: row.procurement_type };
  const newToken = token();
  await db().batch([
    ...await rotateSession(current, buyer.id, newToken),
    ...keys.map(key => db().prepare("DELETE FROM login_attempts WHERE key=?").bind(key)),
  ]);
  return { buyer, hasAccount: true, next: "/marches-publics", token: newToken };
}

export async function changeAccountPassword(request: Request, body: Record<string,unknown>, current: CurrentSession) {
  if(!current.buyer) throw new ApiError("Connectez-vous à votre compte pour changer votre mot de passe.",403);
  const buyer=current.buyer,keys=await rateKeys(request,buyer.email,"account-password");
  await enforceRateLimit(keys);
  const row=await db().prepare("SELECT password_hash FROM buyer_credentials WHERE buyer_id=?").bind(buyer.id).first<{password_hash:string}>();
  if(!row)throw new ApiError("Complétez votre inscription pour activer votre compte.",403);
  const previous=typeof body.currentPassword==="string"&&body.currentPassword.length<=128?body.currentPassword:"";
  if(!await verifyPassword(previous,row.password_hash)){await recordFailure(keys);throw new ApiError("Votre mot de passe actuel est incorrect.",401);}
  const encoded=await encodePassword(registrationPassword(body)),newToken=token(),now=Date.now();
  const changed=await db().batch([
    db().prepare("UPDATE buyer_credentials SET password_hash=? WHERE buyer_id=? AND password_hash=?").bind(encoded,buyer.id,row.password_hash),
    db().prepare("DELETE FROM sessions WHERE buyer_id=? AND EXISTS (SELECT 1 FROM buyer_credentials WHERE buyer_id=? AND password_hash=?)").bind(buyer.id,buyer.id,encoded),
    db().prepare("INSERT INTO sessions (token_hash,buyer_id,expires_at) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM buyer_credentials WHERE buyer_id=? AND password_hash=?)").bind(await hash(newToken),buyer.id,now+86400000,buyer.id,encoded),
    ...keys.map(key=>db().prepare("DELETE FROM login_attempts WHERE key=? AND EXISTS (SELECT 1 FROM buyer_credentials WHERE buyer_id=? AND password_hash=?)").bind(key,buyer.id,encoded)),
  ]);
  if(!changed[0].meta.changes)throw new ApiError("Votre mot de passe vient de changer. Reconnectez-vous avant de réessayer.",409);
  return {buyer,hasAccount:true,next:"/marches-publics",token:newToken};
}
