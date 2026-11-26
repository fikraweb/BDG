export const DOCUMENT_REFERENCE_PREFIX = "TW";

export function parseDocumentReference(value: string) {
  const match = /^(?:TW\s+)?([1-9][0-9]{0,8})\/([1-9][0-9]{3})$/.exec(value.trim());
  return match ? { sequence: match[1], year: match[2] } : null;
}

export function formatDocumentReference(sequence: string | number, year: string | number) {
  return DOCUMENT_REFERENCE_PREFIX + " " + sequence + "/" + year;
}

export function normalizeDocumentReference(value: string) {
  const parts = parseDocumentReference(value);
  return parts ? formatDocumentReference(parts.sequence, parts.year) : value;
}
