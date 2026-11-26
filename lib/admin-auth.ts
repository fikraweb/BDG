import { ApiError, config } from "@/lib/server";

import { hasAdminSession } from "@/lib/security";

export function isTrustedOwner(request:Request){const owner=config("ADMIN_OWNER_EMAIL").trim().toLowerCase();return !!owner&&request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase()===owner;}
export async function isAdmin(request:Request){return hasAdminSession(request);}
export async function requireAdmin(request:Request){if(!await isAdmin(request))throw new ApiError("Connectez-vous avec votre compte administrateur.",403);}
export function checkAdminOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(request.url).origin && origin !== config("SITE_ORIGIN"))) throw new ApiError("Origine de la requête invalide.", 403);
}
export async function limitedBody(request: Request, max: number) {
  if (Number(request.headers.get("content-length") || 0) > max) throw new ApiError("Le fichier ou la demande est trop volumineux.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("Requête vide.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > max) { await reader.cancel(); throw new ApiError("Le fichier ou la demande est trop volumineux.", 413); }
    chunks.push(value);
  }
  const data = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  return data;
}
export function adminFailure(error: unknown) {
  const status = error instanceof ApiError ? error.status : 503;
  if (!(error instanceof ApiError)) console.error("TAWZALA admin unavailable", error instanceof Error ? error.message : "unknown");
  return Response.json({ error: error instanceof ApiError ? error.message : "L’administration est momentanément indisponible. Vos saisies sont conservées. Réessayez." }, { status, headers: { "Cache-Control": "no-store" } });
}
