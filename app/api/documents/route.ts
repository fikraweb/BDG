import { ApiError, session, config } from "@/lib/server";
import { limitedBody } from "@/lib/admin-auth";
import { downloadDocument, listDocumentRequests, submitDocumentRequest } from "@/lib/documents";
export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
function failure(error: unknown) { if (error instanceof ApiError) return json({ error: error.message }, error.status); console.error("Document request failed", error instanceof Error ? error.message : "unknown"); return json({ error: "Les demandes sont momentanément indisponibles. Vos informations restent dans le formulaire; réessayez." }, 503); }
export function pdfResponse(bytes: Uint8Array, id: string) { return new Response(bytes.slice().buffer as ArrayBuffer, { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="' + id + '.pdf"', "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } }); }
export async function GET(request: Request) {
  try { const { buyer } = await session(request, true); const url = new URL(request.url), id = url.searchParams.get("pdf") || url.searchParams.get("receipt"); if (id) return pdfResponse(await downloadDocument(id, buyer!.id, url.searchParams.has("receipt")), id); return json({ requests: await listDocumentRequests(buyer!.id) }); } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try { const { buyer } = await session(request, true), origin = request.headers.get("origin"); if (origin && origin !== new URL(request.url).origin && origin !== config("SITE_ORIGIN")) throw new ApiError("Origine de la requête invalide.", 403); if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ApiError("Requête invalide."); let body; try { body = JSON.parse(new TextDecoder().decode(await limitedBody(request, 16000))); } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError("Requête invalide."); } if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("Requête invalide."); const saved = await submitDocumentRequest(body, buyer!); return json({ request: saved, requests: await listDocumentRequests(buyer!.id) }); } catch (error) { return failure(error); }
}
