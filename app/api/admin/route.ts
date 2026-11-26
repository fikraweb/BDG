import { adminFailure, checkAdminOrigin, limitedBody, requireAdmin } from "@/lib/admin-auth";
import { readPayoutRequests, sendPayoutCode } from "@/lib/payouts";
import { publicSecurity,saveAdminCredentials,saveGatePassword } from "@/lib/security";
import { ApiError } from "@/lib/server";
import { readSettings, saveSettings, saveAccessBanners } from "@/lib/site-store";

export const dynamic = "force-dynamic";
const json = (value: unknown,cookie?:string) => Response.json(value, { headers: { "Cache-Control": "no-store",...(cookie?{"Set-Cookie":cookie}:{}) } });
export async function GET(request: Request) {
  try { await requireAdmin(request); return json({settings:await readSettings(), products:[],security:await publicSecurity(),payoutRequests:await readPayoutRequests(new URL(request.url).searchParams.get("remiseReference")||"")}); } catch (error) { return adminFailure(error); }
}
export async function POST(request: Request) {
  try {
    await requireAdmin(request); checkAdminOrigin(request);
    if (!(request.headers.get("content-type") || "").startsWith("application/json")) throw new ApiError("Requête invalide.");
    let body: Record<string, unknown>;
    try { body = JSON.parse(new TextDecoder().decode(await limitedBody(request, 20000))); } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError("Requête invalide."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("Requête invalide.");
    let payoutDelivery,credentialChange;
    if(body.action==="access-password-save")await saveGatePassword(body);
    else if(body.action==="admin-credentials-save")credentialChange=await saveAdminCredentials(body,request);
    else if(body.action==="payout-send")payoutDelivery=await sendPayoutCode(body);
    else if (body.action === "settings-save") await saveSettings(body);
    else if (body.action === "access-banners-save") await saveAccessBanners(body);
    else throw new ApiError("Action inconnue.");
    return json({settings:await readSettings(), products:[],security:await publicSecurity(),payoutRequests:await readPayoutRequests(),...(payoutDelivery?{payoutDelivery}:{}),...(credentialChange?{adminEmail:credentialChange.email,sessionToken:credentialChange.sessionToken}:{})},credentialChange?credentialChange.cookie:undefined);
  } catch (error) { return adminFailure(error); }
}
