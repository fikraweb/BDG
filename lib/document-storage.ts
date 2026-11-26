import { env } from "cloudflare:workers";
function bucket() { const value = (env as unknown as { CATALOGUE_IMAGES?: R2Bucket }).CATALOGUE_IMAGES; if (!value) throw new Error("Document storage unavailable"); return value; }
export async function saveDocumentBytes(key: string, bytes: Uint8Array) { await bucket().put(key, bytes, { httpMetadata: { contentType: "application/pdf" } }); }
export async function findDocumentBytes(key: string) { const file = await bucket().get(key); return file ? new Uint8Array(await file.arrayBuffer()) : null; }
export async function readDocumentBytes(key: string) { const file = await findDocumentBytes(key); if (!file) throw new Error("Saved document unavailable"); return file; }
export async function discardDocumentBytes(key: string) { await bucket().delete(key); }
