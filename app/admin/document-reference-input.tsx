"use client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOCUMENT_REFERENCE_PREFIX, formatDocumentReference } from "@/lib/document-reference";

export default function DocumentReferenceInput({ value, label, readOnly = false, onValueChange }: { value: string; label: string; readOnly?: boolean; onValueChange: (value: string) => void }) {
  if (readOnly) return <div className="document-reference-editor document-span-all"><span className="document-reference-label">{label}</span><output className="document-reference-preview">{value}</output></div>;
  const parts = /^(?:TW\s+)?([^/]*)\/(\d{4})$/.exec(value.trim());
  const sequence = parts?.[1] || "", year = parts?.[2] || String(new Date().getFullYear());
  const currentYear = new Date().getFullYear();
  const years = [...new Set([year, ...Array.from({ length: Math.max(1, 2050 - (currentYear - 10) + 1) }, (_, index) => String(currentYear - 10 + index))])].sort();
  return <div className="document-reference-editor document-span-all">
    <span className="document-reference-label">{label}</span>
    <div className="document-reference-controls">
      <span className="document-reference-prefix" aria-label="Préfixe de la référence">{DOCUMENT_REFERENCE_PREFIX}</span>
      <label className="field">Numéro<input required inputMode="numeric" pattern="[1-9][0-9]{0,8}" title="Saisissez un numéro entier supérieur à zéro" maxLength={9} placeholder="Ex. : 5" value={sequence} onFocus={event => event.target.select()} onChange={event => onValueChange(formatDocumentReference(event.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""), year))}/></label>
      <span className="document-reference-divider" aria-hidden="true">/</span>
      <div className="field"><span>Année</span><Select value={year} onValueChange={next => onValueChange(formatDocumentReference(sequence, next))}><SelectTrigger aria-label="Année de référence"><SelectValue/></SelectTrigger><SelectContent>{years.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>
    </div>
    <output className="document-reference-preview" aria-live="polite">{sequence ? formatDocumentReference(sequence, year) : "TW …/" + year}</output>
  </div>;
}
