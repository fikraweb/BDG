import {ApiError,config,db,emailField,equal,hash} from "@/lib/server";
import {encodePassword,verifyPassword} from "@/lib/accounts";
import {verifyLegacyAdminPassword} from "@/lib/security-passwords";
import type {SecuritySettings} from "@/lib/security-types";

type SecretSettings={gatePasswordHash:string;adminEmail:string;adminPasswordHash:string;mutation?:string};
type SecurityRow={value:string;revision:number};
const ID="security-main";
async function provisionAdmin(row:SecurityRow){
 const seed=config("ADMIN_BOOTSTRAP_REVISION"),password=config("ADMIN_BOOTSTRAP_PASSWORD"),email=config("ADMIN_BOOTSTRAP_EMAIL");
 if(!seed&&!password&&!email)return row;
 if(!/^[A-Za-z0-9_-]{8,100}$/.test(seed)||password.length<8||password.length>128)throw new Error("Admin access configuration unavailable");
 const marker="admin-bootstrap:"+seed;
 if(await db().prepare("SELECT id FROM site_settings WHERE id=?").bind(marker).first())return row;
 const mutation=crypto.randomUUID(),next={...JSON.parse(row.value) as SecretSettings,adminEmail:emailField(email),adminPasswordHash:await encodePassword(password),mutation},now=Date.now();
 await db().batch([
  db().prepare("UPDATE site_settings SET value=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND NOT EXISTS (SELECT 1 FROM site_settings WHERE id=?)").bind(JSON.stringify(next),now,ID,row.revision,marker),
  db().prepare("DELETE FROM admin_sessions WHERE EXISTS (SELECT 1 FROM site_settings WHERE id=? AND json_extract(value,'$.mutation')=?)").bind(ID,mutation),
  db().prepare("INSERT OR IGNORE INTO site_settings (id,value,revision,updated_at) SELECT ?,'{}',1,? WHERE EXISTS (SELECT 1 FROM site_settings WHERE id=? AND json_extract(value,'$.mutation')=?)").bind(marker,now,ID,mutation),
 ]);
 return await db().prepare("SELECT value,revision FROM site_settings WHERE id=?").bind(ID).first<SecurityRow>()||row;
}
export async function readSecurity(){
 let row=await db().prepare("SELECT value,revision FROM site_settings WHERE id=?").bind(ID).first<SecurityRow>();
 if(!row){const defaults:SecretSettings={gatePasswordHash:config("ACCESS_PASSWORD_HASH"),adminEmail:config("ADMIN_OWNER_EMAIL").trim().toLowerCase(),adminPasswordHash:config("ADMIN_PASSWORD_HASH")};await db().prepare("INSERT OR IGNORE INTO site_settings (id,value,revision,updated_at) VALUES (?,?,1,?)").bind(ID,JSON.stringify(defaults),Date.now()).run();row=await db().prepare("SELECT value,revision FROM site_settings WHERE id=?").bind(ID).first<SecurityRow>();}
 if(!row)throw new Error("Security settings unavailable");
 row=await provisionAdmin(row);
 return {...JSON.parse(row.value) as SecretSettings,revision:row.revision};
}
export async function publicSecurity():Promise<SecuritySettings>{const s=await readSecurity();return {adminEmail:s.adminEmail,hasAdminPassword:!!s.adminPasswordHash,ownerAccess:false,revision:s.revision};}
export async function verifyGatePassword(password:string){const s=await readSecurity();if(/^[a-f0-9]{64}$/.test(s.gatePasswordHash))return equal(await hash(password),s.gatePasswordHash);return /^pbkdf2-sha256\$/.test(s.gatePasswordHash)&&await verifyPassword(password,s.gatePasswordHash);}
export async function verifyAdminPassword(password:string,encoded:string){if(/^scrypt\$/.test(encoded))return verifyLegacyAdminPassword(password,encoded);return verifyPassword(password,/^pbkdf2-sha256\$/.test(encoded)?encoded:null);}
function newPassword(body:Record<string,unknown>){if(typeof body.password!=="string"||body.password.length<8||body.password.length>128)throw new ApiError("Choisissez un mot de passe de 8 à 128 caractères.");if(body.password!==body.confirmPassword)throw new ApiError("Les deux mots de passe ne correspondent pas.");return body.password;}
function checkRevision(value:unknown,current:number){if(!Number.isSafeInteger(value)||value!==current)throw new ApiError("Ces paramètres ont changé. Actualisez avant d’enregistrer.",409);}
export function adminCookie(token:string,request:Request,clear=false){const secure=new URL(request.url).protocol==="https:";return "tawzala_admin="+token+"; Path=/; HttpOnly; Max-Age="+(clear?0:28800)+(secure?"; SameSite=None; Secure; Partitioned":"; SameSite=Lax");}
export function adminToken(request:Request){const token=request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];return token||null;}
export async function ensureAdminSessionPolicy(){
 const policy="admin-login-per-visit-v1";
 if(await db().prepare("SELECT id FROM site_settings WHERE id=?").bind(policy).first())return;
 await db().batch([
  db().prepare("DELETE FROM admin_sessions WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE id=?)").bind(policy),
  db().prepare("INSERT OR IGNORE INTO site_settings (id,value,revision,updated_at) VALUES (?,'{}',1,?)").bind(policy,Date.now()),
 ]);
}
export async function hasAdminSession(request:Request){await ensureAdminSessionPolicy();await readSecurity();const token=adminToken(request);if(!token)return false;return !!await db().prepare("SELECT token_hash FROM admin_sessions WHERE token_hash=? AND expires_at>?").bind(await hash(token),Date.now()).first();}
export async function saveGatePassword(body:Record<string,unknown>){const current=await readSecurity();checkRevision(body.revision,current.revision);const {revision,...old}=current;const value={...old,gatePasswordHash:await encodePassword(newPassword(body)),mutation:crypto.randomUUID()};const result=await db().prepare("UPDATE site_settings SET value=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?").bind(JSON.stringify(value),Date.now(),ID,revision).run();if(!result.meta.changes)throw new ApiError("Ces paramètres ont changé. Actualisez avant d’enregistrer.",409);}
export async function saveAdminCredentials(body:Record<string,unknown>,request:Request,initialSetup=false){
 const current=await readSecurity();checkRevision(body.revision,current.revision);
 if(initialSetup&&current.adminPasswordHash)throw new ApiError("Le compte administrateur est déjà configuré.",409);
 if(!initialSetup){const oldPassword=typeof body.currentPassword==="string"&&body.currentPassword.length<=128?body.currentPassword:"";if(!await verifyAdminPassword(oldPassword,current.adminPasswordHash))throw new ApiError("Le mot de passe administrateur actuel est incorrect.",401);}
 const email=emailField(body.email),password=body.password===undefined||body.password===""?null:newPassword(body);
 if(!password&&!current.adminPasswordHash)throw new ApiError("Choisissez le mot de passe de votre compte administrateur.");
 if(!password&&email===current.adminEmail)throw new ApiError("Modifiez l’email ou indiquez un nouveau mot de passe.");
 const {revision,...old}=current;const mutation=crypto.randomUUID(),next={...old,adminEmail:email,adminPasswordHash:password?await encodePassword(password):current.adminPasswordHash,mutation};
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,"0")).join(""),tokenHash=await hash(token),now=Date.now();
 const result=await db().batch([
  db().prepare("UPDATE site_settings SET value=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?").bind(JSON.stringify(next),now,ID,revision),
  db().prepare("DELETE FROM admin_sessions WHERE EXISTS (SELECT 1 FROM site_settings WHERE id=? AND json_extract(value,'$.mutation')=?)").bind(ID,mutation),
  db().prepare("INSERT INTO admin_sessions (token_hash,expires_at) SELECT ?,? WHERE EXISTS (SELECT 1 FROM site_settings WHERE id=? AND json_extract(value,'$.mutation')=?)").bind(tokenHash,now+28800000,ID,mutation),
 ]);
 if(!result[0].meta.changes)throw new ApiError("Ces paramètres ont changé. Actualisez avant d’enregistrer.",409);
 return {sessionToken:token,cookie:adminCookie("",request,true),email};
}
