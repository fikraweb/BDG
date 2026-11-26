import {adminFailure,checkAdminOrigin,isAdmin,limitedBody} from "@/lib/admin-auth";
import {ApiError,db,hash} from "@/lib/server";
import {adminCookie,adminToken,ensureAdminSessionPolicy,readSecurity,verifyAdminPassword} from "@/lib/security";
const json=(body:unknown,cookie?:string)=>Response.json(body,{headers:{"Cache-Control":"no-store",...(cookie?{"Set-Cookie":cookie}:{})}});
export async function GET(request:Request){try{const authenticated=await isAdmin(request),security=await readSecurity();return json({authenticated,...(authenticated?{email:security.adminEmail}:{})});}catch(error){return adminFailure(error);}}
export async function POST(request:Request){
 try{
  checkAdminOrigin(request);
  if(!(request.headers.get("content-type")||"").startsWith("application/json"))throw new ApiError("Requête invalide.");
  let body:Record<string,unknown>;try{body=JSON.parse(new TextDecoder().decode(await limitedBody(request,4000)));}catch(error){if(error instanceof ApiError)throw error;throw new ApiError("Requête invalide.");}
  if(!body||typeof body!=="object"||Array.isArray(body))throw new ApiError("Requête invalide.");
  await ensureAdminSessionPolicy();
  if(body.action==="logout"){const token=adminToken(request);if(token)await db().prepare("DELETE FROM admin_sessions WHERE token_hash=?").bind(await hash(token)).run();return json({ok:true},adminCookie("",request,true));}
  if(body.action!=="login")throw new ApiError("Action inconnue.");
  const email=typeof body.email==="string"?body.email.trim().toLowerCase():"",now=Date.now();
  const ip=request.headers.get("x-tawzala-client-ip")||request.headers.get("cf-connecting-ip")||"local";
  const keys=["admin-ip:"+await hash(ip),"admin-email:"+await hash(email)];
  for(const key of keys){const attempt=await db().prepare("SELECT count,window_start FROM login_attempts WHERE key=?").bind(key).first<{count:number;window_start:number}>();if(attempt&&now-attempt.window_start<900000&&attempt.count>=5)throw new ApiError("Trop de tentatives. Réessayez dans 15 minutes.",429);}
  const security=await readSecurity(),password=typeof body.password==="string"&&body.password.length<=128?body.password:"";
  const valid=await verifyAdminPassword(password,security.adminPasswordHash);
  if(!valid||email!==security.adminEmail){await db().batch(keys.map(key=>db().prepare("INSERT INTO login_attempts (key,count,window_start) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN ?>window_start+900000 THEN 1 ELSE count+1 END,window_start=CASE WHEN ?>window_start+900000 THEN ? ELSE window_start END").bind(key,now,now,now,now)));throw new ApiError("Email ou mot de passe incorrect.",401);}
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,"0")).join("");
  const result=await db().batch([
   db().prepare("INSERT INTO admin_sessions (token_hash,expires_at) SELECT ?,? WHERE EXISTS (SELECT 1 FROM site_settings WHERE id='security-main' AND revision=?)").bind(await hash(token),now+28800000,security.revision),
   ...keys.map(key=>db().prepare("DELETE FROM login_attempts WHERE key=?").bind(key)),
  ]);
  if(!result[0].meta.changes)throw new ApiError("Les identifiants viennent de changer. Réessayez.",409);
  return json({authenticated:true,email:security.adminEmail,sessionToken:token},adminCookie("",request,true));
 }catch(error){return adminFailure(error);}
}
