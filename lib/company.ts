export const BRAND_NAME = "BDG";
export const DOCUMENT_WEBSITE = "";
export const IMPORTED_CATALOGUE_NAME = "Mobilier de bureaux importation haut de gamme";
export const MOROCCAN_CATALOGUE_NAME = "Mobilier de bureaux marocain";

// Supplier information supplied in the user's example order PDF.
export type Company = { name: string; phone: string; email: string; address: string; rib: string; taxeProfessionnelle: string; cnss: string; ice: string };
export const COMPANY: Company = {
  name: BRAND_NAME,
  phone: "",
  email: "remise@example.com",
  address: "",
  rib: "",
  taxeProfessionnelle: "",
  cnss: "",
  ice: "",
};
