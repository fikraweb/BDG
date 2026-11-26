import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { COMPANY, type Company } from "@/lib/company";
import { regularFont, boldFont } from "@/lib/pdf-fonts";
import { money, type Buyer } from "@/lib/catalog";
import { procurementLabel } from "@/lib/procurement";
import { TAWZALA_CROWN_PNG } from "@/lib/company-mark";
import { payoutName, type PayoutMethod } from "@/lib/payout-types";
import { createRemisePage } from "@/lib/remise-pdf";
import { documentFooterLayout, drawDocumentFooters } from "@/lib/document-footer";

export type SavedOrder = {
  id: string;
  kind: "remise" | "furniture";
  buyer: Buyer;
  details: Record<string, unknown>;
  total: number;
  createdAt: number;
};
type Photo = { data: string; type: string };
type PdfItem = { photoKey?: string; photo?: Photo; dimensions?: { label: string }; name: string; description?: string; specifications?: string[]; quantity: number; price: number };
const W = 595.28, H = 841.89, LEFT = 36, RIGHT = W - 36, BOTTOM = 82;
const navy = rgb(.07, .17, .29), muted = rgb(.35, .40, .46), line = rgb(.80, .84, .88), pale = rgb(.95, .97, .98), white = rgb(1, 1, 1);
const formatMoney = (n: number) => money(n).replace(/[\u00a0\u202f]/g, " ");
const string = (value: unknown, fallback = "Non renseigné") => typeof value === "string" && value.trim() ? value.trim() : fallback;
export function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let start = 0; start < bytes.length; start += 4096) binary += String.fromCharCode(...bytes.subarray(start, start + 4096));
  return btoa(binary);
}
const fontBytes = (data: string) => Uint8Array.from(atob(data), c => c.charCodeAt(0));

export async function createOrderPdf(order: SavedOrder): Promise<Uint8Array> {
  const supplier = (order.details.company || COMPANY) as Company;
  const companyName = supplier.name.replaceAll("🕸", " ").replace(/\s+/g, " ");
  const payout = order.kind === "remise" ? order.details.payout as { orderId: string; provider: PayoutMethod; providerName: string; code: string; amount: number } | undefined : undefined;
  const title = payout ? "AVIS DE VERSEMENT" : order.kind === "remise" ? "DEMANDE DE REMISE D’ACHAT" : "DEMANDE DE COMMANDE";
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  // Full embedded fonts avoid fontkit's shared subset-stream queue when
  // different Worker requests generate their PDFs at the same time.
  // Keep the complete text of a remise request searchable and copyable;
  // this font's full-font Unicode map does not map shaped Latin ligatures.
  const features = order.kind === "remise" && !payout ? { liga: false } : undefined;
  const regular = await pdf.embedFont(fontBytes(regularFont), { subset: false, features });
  const bold = await pdf.embedFont(fontBytes(boldFont), { subset: false, features });
  const crown = await pdf.embedPng(fontBytes(TAWZALA_CROWN_PNG));
  pdf.setTitle(title + " " + order.id);
  pdf.setAuthor(supplier.name);
  pdf.setSubject(string(order.details.objet, "Demande BDG"));
  pdf.setCreationDate(new Date(order.createdAt));
  pdf.setModificationDate(new Date(order.createdAt));
  if (order.kind === "remise" && !payout) { createRemisePage(pdf, order, supplier, regular, bold, crown); return pdf.save(); }
  const date = new Intl.DateTimeFormat("fr-MA", { timeZone: "Africa/Casablanca", dateStyle: "short" }).format(order.createdAt);
  let page!: PDFPage, y = 0;
  function draw(text: string, x: number, top: number, size = 10, font = regular, color = navy) {
    page.drawText(text.replace(/[\r\t\u0000-\u0008]/g, " "), { x, y: top - size, font, size, color });
  }
  function centered(text: string, top: number, size = 10, font = regular, color = navy) {
    draw(text, (W - font.widthOfTextAtSize(text, size)) / 2, top, size, font, color);
  }
  function rightText(text: string, right: number, top: number, size = 10, font = regular, color = navy) {
    draw(text, right - font.widthOfTextAtSize(text, size), top, size, font, color);
  }
  function wrap(text: string, width: number, font: PDFFont, size: number) {
    const lines: string[] = [];
    for (const paragraph of text.split(/\r?\n/)) {
      let current = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const next = current ? current + " " + word : word;
        if (font.widthOfTextAtSize(next, size) <= width) { current = next; continue; }
        if (current) { lines.push(current); current = ""; }
        for (const char of Array.from(word)) {
          if (current && font.widthOfTextAtSize(current + char, size) > width) { lines.push(current); current = ""; }
          current += char;
        }
      }
      lines.push(current || " ");
    }
    return lines;
  }
  const bottom = Math.max(BOTTOM, documentFooterLayout(regular, W).bottom);
  const brandLines = wrap(companyName, RIGHT - LEFT - 40, bold, 16);
  function newPage() {
    page = pdf.addPage([W, H]);
    const crownWidth = 64, crownHeight = crown.height * crownWidth / crown.width;
    page.drawImage(crown, { x: (W - crownWidth) / 2, y: H - 25 - crownHeight, width: crownWidth, height: crownHeight });
    brandLines.forEach((text, i) => centered(text, H - 66 - i * 21, 16, bold));
    const titleTop = H - 66 - brandLines.length * 21 - 13;
    centered(title, titleTop, 14, bold);
    const referenceTop = titleTop - 27;
    draw("Référence : " + order.id, LEFT, referenceTop, 9, regular, muted);
    rightText("Émis le " + date, RIGHT, referenceTop, 9, regular, muted);
    const divider = referenceTop - 22;
    page.drawLine({ start: { x: LEFT, y: divider }, end: { x: RIGHT, y: divider }, thickness: .8, color: line });
    y = divider - 17;
  }
  function ensure(height: number) { if (y - height < bottom) newPage(); }
  function paragraph(text: string, size = 9.5, font = regular, color = navy) {
    const leading = size * 1.4;
    for (const textLine of wrap(text, RIGHT - LEFT, font, size)) { ensure(leading); draw(textLine, LEFT, y, size, font, color); y -= leading; }
    y -= 4;
  }
  function section(title: string) {
    ensure(58); y -= 5;
    page.drawRectangle({ x: LEFT, y: y - 23, width: RIGHT - LEFT, height: 23, color: pale });
    draw(title, LEFT + 8, y - 5, 11, bold); y -= 32;
  }
  newPage();
  section("Informations sur la demande");
  paragraph("Cadre d’achat : " + procurementLabel(order.details.procurementType), 10, bold);
  paragraph("N° / référence du devis : " + string(order.details.devisReference), 10, bold);
  paragraph("Objet de la prestation : " + string(order.details.objet));

  const amount = Number(order.details.amount ?? order.total);
  const rate = Number(order.details.rate ?? 0);
  const discount = Number(order.details.discount ?? 0);
  const net = Number(order.details.net ?? order.total);
  if (order.kind === "furniture") {
    section("Articles demandés");
    const items: PdfItem[] = Array.isArray(order.details.items) && order.details.items.length
      ? order.details.items as PdfItem[]
      : [{ name: "Montant de la commande TTC", quantity: 1, price: amount }];
    const xs = [LEFT, LEFT + 84, LEFT + 310, LEFT + 354, LEFT + 434, RIGHT];
    function tableHeader() {
      ensure(26);
      page.drawRectangle({ x: LEFT, y: y - 25, width: RIGHT - LEFT, height: 25, color: navy });
      ["Photo", "Article / dimensions", "Qté", "Prix unit. (MAD)", "Total (MAD)"].forEach((label, i) => draw(label, xs[i] + 5, y - 7, 8, bold, white));
      y -= 25;
    }
    type CellLine = { text: string; size: number; font: PDFFont; color: ReturnType<typeof rgb>; leading: number };
    const embeddedPhotos = new Map<string, Awaited<ReturnType<typeof pdf.embedJpg>>>();
    tableHeader();
    for (const [index, item] of items.entries()) {
      const photoSnapshot = item.photo || (order.details.photos as Record<string, Photo> | undefined)?.[item.photoKey || ""];
      const width = xs[2] - xs[1] - 14;
      const titleLines = wrap(item.name, width, bold, 9.5);
      const dimensions = item.dimensions ? "Dimensions (L × P × H) : " + item.dimensions.label : "";
      const description = [item.description || "", ...(item.specifications || [])].filter(Boolean).join(" ; ");
      const cells: CellLine[] = [
        ...titleLines.map(text => ({ text, size: 9.5, font: bold, color: navy, leading: 13 })),
        ...(dimensions ? wrap(dimensions, width, bold, 8.5).map(text => ({ text, size: 8.5, font: bold, color: navy, leading: 12 })) : []),
        ...(description ? wrap(description.replace(/\s+/g, " "), width, regular, 8).map(text => ({ text, size: 8, font: regular, color: muted, leading: 11 })) : []),
      ];
      let cursor = 0;
      while (cursor < cells.length) {
        const prefix: CellLine[] = cursor ? wrap(item.name + " (suite)", width, bold, 9.5).map(text => ({ text, size: 9.5, font: bold, color: navy, leading: 13 })) : [];
        const prefixHeight = prefix.reduce((sum, cell) => sum + cell.leading, 0);
        const minimum = Math.max(photoSnapshot ? 88 : 42, 20 + prefixHeight + cells[cursor].leading);
        if (y - minimum < bottom) { newPage(); tableHeader(); }
        let end = cursor, height = 20 + prefixHeight;
        while (end < cells.length && height + cells[end].leading <= y - bottom) { height += cells[end].leading; end++; }
        const firstPart = cursor === 0;
        const rowHeight = Math.max(photoSnapshot ? 88 : 42, height);
        page.drawRectangle({ x: LEFT, y: y - rowHeight, width: RIGHT - LEFT, height: rowHeight, borderWidth: .6, borderColor: line, color: index % 2 ? pale : white });
        for (const x of xs.slice(1, -1)) page.drawLine({ start: { x, y }, end: { x, y: y - rowHeight }, thickness: .5, color: line });
        if (photoSnapshot) {
          let photo = embeddedPhotos.get(photoSnapshot.data);
          if (!photo) { photo = photoSnapshot.type === "image/png" ? await pdf.embedPng(fontBytes(photoSnapshot.data)) : await pdf.embedJpg(fontBytes(photoSnapshot.data)); embeddedPhotos.set(photoSnapshot.data, photo); }
          const scale = Math.min(70 / photo.width, 68 / photo.height), photoWidth = photo.width * scale, photoHeight = photo.height * scale;
          page.drawImage(photo, { x: LEFT + 7 + (70 - photoWidth) / 2, y: y - 10 - photoHeight, width: photoWidth, height: photoHeight });
        }
        let rowY = y - 9;
        for (const cell of [...prefix, ...cells.slice(cursor, end)]) { draw(cell.text, xs[1] + 7, rowY, cell.size, cell.font, cell.color); rowY -= cell.leading; }
        if (firstPart) {
          rightText(String(item.quantity), xs[3] - 8, y - 10, 9);
          rightText(formatMoney(item.price).replace(" MAD", ""), xs[4] - 6, y - 10, 8.3);
          rightText(formatMoney(item.price * item.quantity).replace(" MAD", ""), RIGHT - 6, y - 10, 8.3, bold);
        }
        y -= rowHeight; cursor = end;
      }
    }
    y -= 17; ensure(78);
    page.drawRectangle({ x: LEFT + 205, y: y - 64, width: RIGHT - LEFT - 205, height: 64, color: navy });
    draw("Total de la commande TTC", LEFT + 219, y - 10, 12, bold, white);
    rightText(formatMoney(amount), RIGHT - 14, y - 32, 21, bold, white); y -= 80;
    section("Livraison");
    paragraph("Ville de livraison : " + string(order.details.deliveryCity));
    if (order.details.deliveryDeadline) paragraph("Délai / date souhaité : " + string(order.details.deliveryDeadline));
  } else {
    section("Récapitulatif de la remise d’achat");
    paragraph("Montant total du devis TTC : " + formatMoney(amount), 11, bold);
    paragraph("Taux de remise : " + rate + " %");
    y -= 8; ensure(138);
    page.drawRectangle({ x: LEFT + 205, y: y - 78, width: RIGHT - LEFT - 205, height: 78, color: navy });
    draw("Remise d’achat · " + rate + " %", LEFT + 219, y - 12, 14, bold, white);
    rightText(formatMoney(discount), RIGHT - 14, y - 37, 23, bold, white); y -= 91;
    draw("Prix après remise", LEFT + 205, y, 9, regular, muted);
    rightText(formatMoney(net), RIGHT - 8, y, 9, bold); y -= 24;
    if (payout) {
      section("Code personnel de transfert");
      paragraph("Demande d’origine : " + payout.orderId, 10, bold);
      paragraph("Service de retrait : " + payout.providerName, 11, bold);
      paragraph("Montant versé : " + formatMoney(payout.amount), 13, bold);
      paragraph("Code / numéro de transfert : " + payout.code, 15, bold);
      paragraph("Ce code est personnel. Présentez-le auprès du service de transfert avec les documents demandés par celui-ci.", 9, regular, muted);
    } else if (order.details.paymentMethod === "cashplus" || order.details.paymentMethod === "wafacash") {
      paragraph("Versement : " + payoutName(order.details.paymentMethod) + " - prévu sous 24 heures. Code de transfert envoyé par email.", 9, bold);
    }
  }
  const clientFields: { text: string; size: number; font: PDFFont }[] = [
    { text: "Nom et prénom : " + order.buyer.name, size: 10, font: bold },
    { text: "Maître d’ouvrage : " + string(order.details.maitreOuvrage, order.buyer.maitreOuvrage || "Non renseigné"), size: 9.5, font: regular },
    { text: "Téléphone : " + string(order.details.phone, order.buyer.phone), size: 9.5, font: regular },
    { text: "Email : " + string(order.details.email, order.buyer.email), size: 9.5, font: regular },
    { text: "Ville : " + string(order.details.clientCity, order.buyer.city || "Non renseignée"), size: 9.5, font: regular },
  ];
  const signatureHeight = 78;
  const clientHeight = 37 + clientFields.reduce((height, field) => height + wrap(field.text, RIGHT - LEFT, field.font, field.size).length * field.size * 1.4 + 4, 0);
  const clientBlockHeight = clientHeight + signatureHeight + 20;
  const contentTop = H - 145 - brandLines.length * 21;
  if (clientBlockHeight <= contentTop - bottom) ensure(clientBlockHeight);
  section("Informations du client");
  clientFields.forEach(field => paragraph(field.text, field.size, field.font));
  {
    ensure(signatureHeight + 20); y -= 8;
    draw("Cachet et signature", RIGHT - 195, y, 10, bold); y -= signatureHeight;
  }
  drawDocumentFooters(pdf, regular);
  return pdf.save();
}
