import type { Product } from "@/lib/catalog";
import type { Company } from "@/lib/company";

export type Catalogue = "office" | "moroccan";
export type ManagedProduct = Product & { catalogue: Catalogue; active: boolean; demonstration: boolean; position: number; revision: number };
export type SiteSettings = { company: Company; remiseRate: number; revision: number };
export type SiteStore = { settings: SiteSettings; products: ManagedProduct[] };
