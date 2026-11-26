import { rgb, type PDFDocument, type PDFFont, type PDFImage } from "pdf-lib";
import type { SavedOrder } from "@/lib/order-pdf";
import type { Company } from "@/lib/company";
import { documentFooterLayout, drawDocumentFooters } from "@/lib/document-footer";
import { money } from "@/lib/catalog";
import { procurementLabel } from "@/lib/procurement";
import { payoutName } from "@/lib/payout-types";

// Measure the complete request before drawing. Remise requests never contain
// a product table. A4 is used normally; unusually dense, maximum-length fields
// use one A3 sheet to preserve every word at a readable size.
export function createRemisePage(pdf: PDFDocument, order: SavedOrder, company: Company, regular: PDFFont, bold: PDFFont, crown: PDFImage, largeSheet = false): void {
  const W = largeSheet ? 841.89 : 595.28, H = largeSheet ? 1190.55 : 841.89, L = 36, R = W - L, width = R - L;
  const navy = rgb(.07,.17,.29), muted = rgb(.35,.40,.46), pale = rgb(.95,.97,.98), rule = rgb(.80,.84,.88), white = rgb(1,1,1);
  const clean = (value: unknown, fallback = "Non renseigné") => typeof value === "string" && value.trim() ? value.replace(/\s+/g, " ").trim() : fallback;
  const format = (value: number) => money(value).replace(/[\u00a0\u202f]/g," ");
  const brand = clean(company.name.replaceAll("🕸", " "));
  const amount = Number(order.details.amount ?? order.total), discount = Number(order.details.discount ?? 0), rate = Number(order.details.rate ?? 0), net = Number(order.details.net ?? order.total);
  const date = new Intl.DateTimeFormat("fr-MA", { dateStyle: "short", timeZone: "Africa/Casablanca" }).format(order.createdAt);
  function wrap(text: string, font: PDFFont, size: number, available = width) {
    const result: string[] = []; let row = "";
    for (const word of text.split(/\s+/).filter(Boolean)) {
      if (font.widthOfTextAtSize(row ? row + " " + word : word,size) <= available) { row = row ? row + " " + word : word; continue; }
      if (row) { result.push(row); row = ""; }
      for (const letter of Array.from(word)) { if (row && font.widthOfTextAtSize(row + letter,size) > available) { result.push(row); row = ""; } row += letter; }
    }
    result.push(row || " "); return result;
  }
  const requestFields = [
    "Cadre d’achat : " + procurementLabel(order.details.procurementType),
    "N° / référence du devis : " + clean(order.details.devisReference),
    "Objet de la prestation : " + clean(order.details.objet),
  ];
  const clientFields = [
    "Nom et prénom : " + clean(order.buyer.name),
    "Maître d’ouvrage : " + clean(order.details.maitreOuvrage, order.buyer.maitreOuvrage || "Non renseigné"),
    "Téléphone : " + clean(order.details.phone, order.buyer.phone),
    "Email : " + clean(order.details.email, order.buyer.email),
    "Ville : " + clean(order.details.clientCity, order.buyer.city || "Non renseignée"),
  ];
  const provider = order.details.paymentMethod === "cashplus" || order.details.paymentMethod === "wafacash" ? payoutName(order.details.paymentMethod) : clean(order.details.paymentMethod);
  const payment = "Versement : " + provider + " - prévu sous 24 heures. Code de transfert envoyé par email.";
  const bottom = documentFooterLayout(regular, W).bottom;
  const signatureHeight = 64;
  function measure(size: number) {
    const compact = size <= 8.5, gap = compact ? 2 : 5, leading = size * (compact ? 1.18 : 1.35), heading = compact ? 21 : 27;
    const brandSize = compact ? 12 : 15, names = wrap(brand,bold,brandSize), crownWidth = compact ? 46 : 56, crownHeight = crown.height * crownWidth / crown.width;
    const top = H - 20 - crownHeight - 7 - names.length * (brandSize + 4) - 23 - 27;
    const paragraphs = [...requestFields,payment,...clientFields];
    const textHeight = paragraphs.reduce((sum,text) => sum + wrap(text,regular,size).length * leading + gap,0);
    const hero = compact ? 62 : 78, summary = compact ? 33 : 40;
    const height = hero + summary + heading * 2 + textHeight + gap * 4 + signatureHeight + 20;
    return { size, gap, leading, heading, brandSize, names, crownWidth, crownHeight, top, hero, summary, height };
  }
  let layout = measure(10);
  for (const size of [9.5,9,8.5,8]) { if (layout.top - layout.height >= bottom) break; layout = measure(size); }
  if (layout.top - layout.height < bottom) {
    // Dense, maximum-length fields keep every word and the same page. Reduce
    // spacing before reducing text, including superfluous input whitespace.
    layout.leading = layout.size * 1.05; layout.gap = 1; layout.heading = 18; layout.hero = 54; layout.summary = 29;
    const paragraphs = [...requestFields,payment,...clientFields];
    layout.height = layout.hero + layout.summary + layout.heading * 2 + paragraphs.reduce((sum,text)=>sum+wrap(text,regular,layout.size).length*layout.leading+layout.gap,0) + layout.gap*4 + signatureHeight + 20;
  }
  if (layout.top - layout.height < bottom) {
    if (!largeSheet) return createRemisePage(pdf,order,company,regular,bold,crown,true);
    throw new Error("Remise PDF content exceeds one page");
  }
  const page = pdf.addPage([W,H]);
  function draw(text: string, x: number, top: number, size = layout.size, font = regular, color = navy) { page.drawText(text,{x,y:top-size,size,font,color}); }
  function center(text: string, top: number, size: number, font = regular, color = navy) { draw(text,(W-font.widthOfTextAtSize(text,size))/2,top,size,font,color); }
  page.drawImage(crown,{x:(W-layout.crownWidth)/2,y:H-20-layout.crownHeight,width:layout.crownWidth,height:layout.crownHeight});
  const brandTop = H-20-layout.crownHeight-7;
  layout.names.forEach((text,index)=>center(text,brandTop-index*(layout.brandSize+4),layout.brandSize,bold));
  const titleTop=brandTop-layout.names.length*(layout.brandSize+4)-3;
  center("DEMANDE DE REMISE D’ACHAT",titleTop,14,bold);
  draw("Référence : "+order.id,L,titleTop-23,8.5,regular,muted);
  const issued="Émis le "+date;draw(issued,R-regular.widthOfTextAtSize(issued,8.5),titleTop-23,8.5,regular,muted);
  let y=layout.top;
  page.drawRectangle({x:L,y:y-layout.hero,width,height:layout.hero,color:navy});
  center("Remise d’achat · "+rate+" %",y-9,12,bold,white);
  const formatted=format(discount), amountSize=Math.min(layout.hero>62?26:22,(width-28)/bold.widthOfTextAtSize(formatted,1));
  center(formatted,y-28,amountSize,bold,white);y-=layout.hero+layout.gap;
  for(const [index,[label,value]] of [["Montant total du devis TTC",amount],["Prix après remise",net]].entries()) {
    const x=L+index*(width/2+4), w=width/2-4;
    draw(String(label),x+7,y-3,8,regular,muted);
    const text=format(Number(value)), size=Math.min(10,(w-14)/bold.widthOfTextAtSize(text,1));draw(text,x+7,y-15,size,bold);
  }
  y-=layout.summary;
  function section(label:string){page.drawRectangle({x:L,y:y-layout.heading+4,width,height:layout.heading-4,color:pale});draw(label,L+8,y-4,layout.size+1,bold);y-=layout.heading;}
  function paragraph(text:string){for(const line of wrap(text,regular,layout.size)){draw(line,L,y);y-=layout.leading;}y-=layout.gap;}
  section("Informations sur la demande");requestFields.forEach(paragraph);paragraph(payment);
  y-=layout.gap;section("Informations du client");clientFields.forEach(paragraph);y-=layout.gap;
  draw("Cachet et signature",R-195,y,layout.size,bold);
  drawDocumentFooters(pdf,regular);
}
