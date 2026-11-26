import { db } from "@/lib/server";
import { DOCUMENT_TYPES, type DocumentKind } from "@/lib/document-types";
import { formatDocumentReference, parseDocumentReference } from "@/lib/document-reference";

// Evaluated inside the INSERT/UPDATE that reserves the number. The existing
// unique (kind, document_number) index also protects manually entered numbers.
export const NEXT_DOCUMENT_NUMBER_SQL = `SELECT 'TW '||CAST(COALESCE(MAX(CAST(sequence AS INTEGER)),0)+1 AS TEXT)||'/'||? AS number
  FROM (SELECT CASE WHEN substr(document_number,1,3)='TW ' THEN substr(document_number,4,instr(document_number,'/')-4) ELSE substr(document_number,1,instr(document_number,'/')-1) END AS sequence,
    substr(document_number,instr(document_number,'/')+1) AS year
    FROM document_requests WHERE kind=? AND id<>? AND instr(document_number,'/')>1)
  WHERE sequence<>'' AND sequence NOT GLOB '*[^0-9]*' AND year=?`;

export function numberingParameters(kind: DocumentKind, referenceOrDate: string, excludeId = "") {
  const year = parseDocumentReference(referenceOrDate)?.year || referenceOrDate.slice(0, 4);
  return [year, kind, excludeId, year];
}
export async function nextDocumentNumbers(date = new Date().toISOString().slice(0, 10)) {
  const result = {} as Record<DocumentKind, string>;
  for (const kind of Object.keys(DOCUMENT_TYPES) as DocumentKind[]) {
    const row = await db().prepare(NEXT_DOCUMENT_NUMBER_SQL).bind(...numberingParameters(kind, date)).first<{ number: string }>();
    result[kind] = row?.number || formatDocumentReference(1, date.slice(0, 4));
  }
  return result;
}
