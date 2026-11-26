export const PROCUREMENT_OPTIONS = {
  bon_de_commande: "Bon de commande",
  marches: "Marchés",
} as const;

export type ProcurementType = keyof typeof PROCUREMENT_OPTIONS;

export function isProcurementType(value: unknown): value is ProcurementType {
  return value === "bon_de_commande" || value === "marches";
}

export function procurementLabel(value: unknown) {
  return isProcurementType(value) ? PROCUREMENT_OPTIONS[value] : "Non renseigné";
}
