import type { ProcurementType } from "@/lib/procurement";
import { importedExtras, moroccanOfficeSeeds } from "@/lib/catalogue-seeds";
import { premiumExpanded, moroccanExpanded } from "@/lib/catalogue-seeds-v19";
export type CustomDimensions = { lengthCm:number; depthCm:number; heightCm:number };
export type CustomSizing = { enabled:boolean; pricing:"length"|"area"|"volume"; minLengthCm:number; maxLengthCm:number; minDepthCm:number; maxDepthCm:number; minHeightCm:number; maxHeightCm:number };
export type ProductSize = { id: string; label: string; lengthCm: number; depthCm: number; heightCm: number; price: number };
export type ProductPhoto = { image: string; label: string };
export type Product = { id: string; name: string; category: string; price: number; image: string; gallery?: ProductPhoto[]; description: string; details: string[]; demonstration?: boolean; sizes?: ProductSize[]; customSizing?: CustomSizing };

const baseOfficeProducts: Product[] = [
  { id: "bureau-noyer", name: "Bureau de direction Noyer", category: "Bureaux", price: 4200, image: "/images/walnut-desk.webp", description: "Une ligne épurée, une finition noyer et un caisson mobile pour organiser votre espace de travail.", details: ["Plateau finition noyer", "Piètement en métal anthracite", "Caisson mobile à trois tiroirs", "Modèle et prix de démonstration"] },
  { id: "fauteuil-signature", name: "Fauteuil ergonomique Signature", category: "Fauteuils", price: 1800, image: "/images/executive-chair.webp", description: "Un fauteuil en maille respirante avec appui-tête, pensé pour les espaces professionnels.", details: ["Dossier en maille noire", "Appui-tête et accoudoirs", "Piètement à roulettes", "Modèle et prix de démonstration"] },
  {
    id: "bureau-compact", name: "Bureau Compact", category: "Bureaux", price: 1500,
    image: "/images/compact-desk.webp",
    description: "Un bureau compact en finition chêne clair, facile à intégrer dans les petits espaces de travail.",
    details: ["Plateau rectangulaire finition chêne clair", "Piètement en métal blanc", "Ligne ouverte sans caisson", "Modèle et prix de démonstration"]
  },
  {
    id: "bureau-angle-horizon", name: "Bureau d’angle Horizon", category: "Bureaux", price: 3600,
    image: "/images/corner-desk.webp",
    description: "Un plateau en L et une finition noyer pour disposer d’un espace de travail généreux.",
    details: ["Plateau d’angle en L", "Finition noyer", "Structure anthracite", "Modèle et prix de démonstration"]
  },
  {
    id: "table-reunion-atlas", name: "Table de réunion Atlas", category: "Tables", price: 5200,
    image: "/images/meeting-table.webp",
    description: "Une table de réunion aux angles adoucis, associant un plateau finition noyer à un piètement sombre.",
    details: ["Grand plateau rectangulaire", "Angles arrondis et finition noyer", "Piètement en métal sombre", "Modèle et prix de démonstration"]
  },
  {
    id: "fauteuil-visiteur-ligne", name: "Fauteuil visiteur Ligne", category: "Fauteuils", price: 650,
    image: "/images/visitor-chair.webp",
    description: "Un fauteuil visiteur noir avec accoudoirs, pour les espaces d’accueil et les salles de réunion.",
    details: ["Assise et dossier rembourrés noirs", "Accoudoirs intégrés", "Piètement luge en métal noir", "Modèle et prix de démonstration"]
  },
  {
    id: "fauteuil-direction-prestige", name: "Fauteuil de direction Prestige", category: "Fauteuils", price: 2400,
    image: "/images/director-chair.webp",
    description: "Un fauteuil de direction à dossier haut, habillé d’une teinte cognac et monté sur roulettes.",
    details: ["Dossier haut rembourré", "Revêtement aspect cuir cognac", "Piètement noir à cinq branches et roulettes", "Modèle et prix de démonstration"]
  },
  {
    id: "armoire-alto", name: "Armoire de rangement Alto", category: "Rangement", price: 2200,
    image: "/images/storage-cabinet.webp",
    description: "Une armoire haute à deux portes, en finition chêne clair, pour organiser les documents de votre bureau.",
    details: ["Deux portes pleines", "Finition chêne clair", "Poignées noires", "Modèle et prix de démonstration"]
  },
  {
    id: "caisson-trio", name: "Caisson mobile Trio", category: "Rangement", price: 850,
    image: "/images/mobile-pedestal.webp",
    description: "Un caisson blanc à trois tiroirs sur roulettes, avec un dessus en finition chêne clair.",
    details: ["Trois tiroirs", "Dessus finition chêne clair et corps blanc", "Quatre roulettes", "Modèle et prix de démonstration"]
  },
  {
    id: "bibliotheque-ouverte", name: "Bibliothèque ouverte", category: "Rangement", price: 1900,
    image: "/images/office-bookcase.webp",
    description: "Une bibliothèque ouverte en finition chêne clair pour garder dossiers et fournitures à portée de main.",
    details: ["Rangement ouvert à plusieurs niveaux", "Finition chêne clair", "Format vertical", "Modèle et prix de démonstration"]
  }
];

const premiumPrices = [14500, 6800, 8900, 17500, 22500, 2900, 9500, 11500, 3900, 9800];
const dimensions = [[180,80,75],[65,65,115],[140,70,75],[180,160,75],[240,120,75],[55,60,90],[65,65,120],[90,45,198],[40,50,60],[90,35,180]];
export const officeProducts: Product[] = [...baseOfficeProducts.map((p,i) => {
  const [lengthCm,depthCm,heightCm] = dimensions[i], price = premiumPrices[i];
  const lengths = p.category === "Bureaux" ? [...new Set([lengthCm,120,140,160,180,200])] : p.category === "Tables" ? [...new Set([lengthCm,200,240,300,360])] : [lengthCm];
  const sizes = lengths.map(length => ({ id: "l"+length, label: `${length/100} × ${depthCm/100} × ${heightCm/100} m`, lengthCm:length, depthCm, heightCm, price:length===lengthCm ? price : Math.round(price*length/lengthCm/10)*10 }));
  return {...p,price,sizes,demonstration:true};
}), ...importedExtras, ...premiumExpanded].map(withCustomSizing);
export const moroccanProducts: Product[] = [...moroccanOfficeSeeds,...moroccanExpanded].map(withCustomSizing);

export const products: Product[] = [...officeProducts, ...moroccanProducts];

export type Buyer = { id: string; name: string; phone: string; email: string; maitreOuvrage: string | null; city: string | null; procurementType?: ProcurementType | null };
export type CartLine = { productId: string; quantity: number; sizeId?: string; customDimensions?:CustomDimensions };
export function cartKey(line: Pick<CartLine,"productId"|"sizeId"|"customDimensions">) { return line.productId+":"+(line.customDimensions?`custom:${line.customDimensions.lengthCm}:${line.customDimensions.depthCm}:${line.customDimensions.heightCm}`:line.sizeId||""); }
function withCustomSizing(p:Product):Product { const category=p.category==="Bureaux multipostes"?"Bureaux":p.category;return {...p,category,customSizing:p.customSizing||(p.sizes?.[0]?defaultCustomSizing(p.sizes[0],category):undefined)}; }
export function defaultCustomSizing(size:ProductSize,category="Bureaux"):CustomSizing {
  return {enabled:true,pricing:category==="Rangement"?"volume":category==="Canapés"||category==="Fauteuils"?"length":"area",minLengthCm:Math.max(1,Math.round(size.lengthCm*.5)),maxLengthCm:Math.min(1000,Math.round(size.lengthCm*2)),minDepthCm:Math.max(1,Math.round(size.depthCm*.5)),maxDepthCm:Math.min(500,Math.round(size.depthCm*2)),minHeightCm:Math.max(1,Math.round(size.heightCm*.5)),maxHeightCm:Math.min(500,Math.round(size.heightCm*2))};
}
export function productSize(product: Product, sizeId?: string, custom?: CustomDimensions): ProductSize | undefined {
  if(custom){
    const policy=product.customSizing,base=product.sizes?.[0];
    if(!policy?.enabled||!base||sizeId)throw new Error("Les dimensions personnalisées ne sont pas disponibles pour ce modèle.");
    const dims={} as CustomDimensions;
    for(const key of ["lengthCm","depthCm","heightCm"] as const){
      const value=custom[key],min=policy[("min"+key[0].toUpperCase()+key.slice(1)) as keyof CustomSizing],max=policy[("max"+key[0].toUpperCase()+key.slice(1)) as keyof CustomSizing];
      if(typeof value!=="number"||!Number.isFinite(value)||value<=0||value<Number(min)||value>Number(max))throw new Error("Saisissez des dimensions comprises dans les limites indiquées.");
      dims[key]=Math.round(value*100)/100;
    }
    let ratio=dims.lengthCm/base.lengthCm;
    if(policy.pricing!=="length")ratio*=dims.depthCm/base.depthCm;
    if(policy.pricing==="volume")ratio*=dims.heightCm/base.heightCm;
    const price=Math.round(base.price*100*ratio)/100;
    if(!Number.isFinite(price)||price<.01||price>1e8)throw new Error("Prix personnalisé invalide.");
    return {id:"custom",label:`${dims.lengthCm/100} × ${dims.depthCm/100} × ${dims.heightCm/100} m`,...dims,price};
  }
  if (!product.sizes?.length) { if (sizeId) throw new Error("Cette dimension n’est plus disponible."); return undefined; }
  const size = sizeId ? product.sizes.find(s => s.id === sizeId) : product.sizes[0];
  if (!size) throw new Error("Cette dimension n’est plus disponible. Actualisez le catalogue.");
  return size;
}
// Only server-owned pricing applies to requests. Customer inputs never set this rate.
export const REMISE_RATE = 5;
export type PriceQuote = { amount: number; rate: number; discount: number; net: number };
export const CURRENCY = "MAD";
export function money(value: number) { return new Intl.NumberFormat("fr-MA", { style: "currency", currency: CURRENCY, currencyDisplay: "code", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value); }
export function calculateRemise(amount: number, rate = REMISE_RATE): PriceQuote {
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error("Taux de remise invalide.");
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e10) throw new Error("Saisissez un montant positif, inférieur ou égal à 10 milliards de DH.");
  const amountCents = Math.round(amount * 100);
  if (amountCents === 0) throw new Error("Le montant doit être d’au moins 0,01 DH.");
  const discountCents = Math.round(amountCents * rate / 100);
  return { amount: amountCents / 100, rate, discount: discountCents / 100, net: (amountCents - discountCents) / 100 };
}
export function priceFurniture(lines: CartLine[], catalogue: Product[]) {
  const items = lines.map(line => {
    const p = catalogue.find(product => product.id === line.productId);
    if (!p) throw new Error("Produit invalide.");
    const size = productSize(p,line.sizeId,line.customDimensions);
    return { productId: p.id, name: p.name, description: p.description, specifications: [...p.details], image: p.image, sizeId:line.customDimensions?undefined:size?.id, customDimensions:line.customDimensions, dimensions: size ? { lengthCm:size.lengthCm, depthCm:size.depthCm, heightCm:size.heightCm, label:size.label, custom:!!line.customDimensions } : undefined, price: size?.price ?? p.price, quantity: line.quantity };
  });
  const amount = items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0) / 100;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e10) throw new Error("Montant de commande invalide.");
  return { items, amount, demonstration: items.some(item => catalogue.find(p => p.id === item.productId)?.demonstration !== false) };
}
export type FurnitureQuote = ReturnType<typeof priceFurniture>;
export function priceCart(lines: CartLine[], catalogue: Product[], rate: number) {
  const result = priceFurniture(lines, catalogue);
  return { ...result, ...calculateRemise(result.amount, rate) };
}
