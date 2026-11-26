import { ApiError } from "@/lib/server";
import { requireAdmin, checkAdminOrigin, limitedBody, adminFailure } from "@/lib/admin-auth";
import { listDocumentRequests, downloadDocument, previewDocument, saveDocumentDraft, sendDocument, createAdminDocument } from "@/lib/documents";
import { pdfResponse } from "@/app/api/documents/route";
import { nextDocumentNumbers } from "@/lib/document-numbering";
export const dynamic = "force-dynamic";
const json = (value: unknown) => Response.json(value, { headers: { "Cache-Control": "no-store" } });
export async function GET(request: Request) { try { await requireAdmin(request); const url = new URL(request.url), id = url.searchParams.get("pdf") || url.searchParams.get("receipt"); if (id) return pdfResponse(await downloadDocument(id, undefined, url.searchParams.has("receipt")), id); return json({ requests: await listDocumentRequests(undefined, url.searchParams.get("q") || ""), nextNumbers: await nextDocumentNumbers() }); } catch (error) { return adminFailure(error); } }
export async function POST(request: Request) {
  try { await requireAdmin(request); checkAdminOrigin(request); if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ApiError("Requête invalide."); let body; try { body = JSON.parse(new TextDecoder().decode(await limitedBody(request, 150000))); } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError("Requête invalide."); } if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("Requête invalide."); if (body.action === "preview") return pdfResponse(await previewDocument(body), "APERCU"); const saved = body.action === "create" ? await createAdminDocument(body) : body.action === "save" ? await saveDocumentDraft(body) : body.action === "send" ? await sendDocument(body) : null; if (!saved) throw new ApiError("Action inconnue."); return json({ request: saved, requests: await listDocumentRequests(), nextNumbers: await nextDocumentNumbers() }); } catch (error) { return adminFailure(error); }
}
