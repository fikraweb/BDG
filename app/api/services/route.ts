import { adminFailure, checkAdminOrigin, limitedBody, requireAdmin } from "@/lib/admin-auth";
import { isServiceRequestKind, type ServiceRequest } from "@/lib/buyer-services";
import { ApiError, db, hash, session, textField } from "@/lib/server";

function reply(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const rows = await db().prepare(
      `SELECT r.id, r.kind, r.subject, r.message, b.name, b.email, r.created_at AS createdAt
       FROM buyer_service_requests r JOIN buyers b ON b.id = r.buyer_id
       ORDER BY r.created_at DESC LIMIT 100`,
    ).all<ServiceRequest>();
    return reply({ requests: rows.results });
  } catch (error) {
    return adminFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    const { buyer } = await session(request, true);
    checkAdminOrigin(request);
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ApiError("Requête invalide.");
    let data: unknown;
    try {
      data = JSON.parse(new TextDecoder().decode(await limitedBody(request, 16000)));
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Requête invalide.");
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new ApiError("Requête invalide.");
    const { kind, subject, message, key } = data as Record<string, unknown>;
    if (!isServiceRequestKind(kind) || typeof key !== "string" || !/^[0-9a-f-]{36}$/i.test(key)) {
      throw new ApiError("Requête invalide.");
    }
    const title = textField(subject, "L’objet", 160);
    const body = textField(message, "Le message", 3000);
    const reference = "BDG-" + (await hash(buyer!.id + ":" + kind + ":" + key)).slice(0, 16).toUpperCase();
    await db().prepare(
      `INSERT INTO buyer_service_requests (id, buyer_id, kind, subject, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
    ).bind(reference, buyer!.id, kind, title, body, Date.now()).run();
    return reply({ reference }, 201);
  } catch (error) {
    if (error instanceof ApiError) return reply({ error: error.message }, error.status);
    console.error("BDG service request failed", error instanceof Error ? error.message : "unknown");
    return reply({ error: "La demande n’a pas pu être enregistrée. Réessayez." }, 503);
  }
}
