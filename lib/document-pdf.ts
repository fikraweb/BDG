import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { regularFont, boldFont } from "@/lib/pdf-fonts";
import { TAWZALA_CROWN_PNG } from "@/lib/company-mark";
import type { Company } from "@/lib/company";
import { money } from "@/lib/catalog";
import { procurementLabel } from "@/lib/procurement";
import { documentLabel, documentTotals, amountInWords, type DocumentRequest, type IssuedDocument } from "@/lib/document-types";
import { documentFooterLayout, drawDocumentFooters } from "@/lib/document-footer";

const bytes = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));
const W = 595.28, H = 841.89, L = 36, R = W - 36, WIDTH = R - L;
const navy = rgb(.07, .17, .29), accent = rgb(.14, .42, .47), muted = rgb(.35, .43, .49), line = rgb(.79, .84, .88), pale = rgb(.96, .975, .985), white = rgb(1, 1, 1);
export async function createBusinessPdf(request: DocumentRequest, company: Company, issued?: IssuedDocument) {
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  // Full fonts keep independent Worker requests safe; disabling ligatures also
  // keeps document references and legal details searchable in the PDF text.
  const regular = await pdf.embedFont(bytes(regularFont), { subset: false, features: { liga: false } });
  const bold = await pdf.embedFont(bytes(boldFont), { subset: false, features: { liga: false } });
  const crown = await pdf.embedPng(bytes(TAWZALA_CROWN_PNG));
  const draft = issued?.draft, contact = draft?.contact || request.contact;
  const brand = company.name.replaceAll("🕸", " ").replace(/\s+/g, " ");
  const market = !!issued && request.kind === "facture" && contact.procurementType === "marches";
  const title = market ? "BORDEREAU DES PRIX – DÉTAIL ESTIMATIF" : issued ? documentLabel(request.kind).toUpperCase() : "ACCUSÉ DE RÉCEPTION";
  const reference = draft?.number || request.id;
  const date = draft ? draft.date.split("-").reverse().join("/") : new Intl.DateTimeFormat("fr-MA", { dateStyle: "short", timeZone: "Africa/Casablanca" }).format(request.createdAt);
  pdf.setTitle(title + " · " + reference); pdf.setAuthor(company.name);
  pdf.setCreationDate(new Date(issued?.createdAt || request.createdAt)); pdf.setModificationDate(new Date(issued?.createdAt || request.createdAt));
  const bottom = documentFooterLayout(regular, W).bottom;
  let page!: PDFPage, y = 0, contentTop = 0;
  function draw(text: string, x: number, top: number, size = 10, font = regular, color = navy) {
    page.drawText(text.replace(/[\r\t\u0000-\u0008]/g, " "), { x, y: top - size, size, font, color });
  }
  function wrap(text: string, width: number, font: PDFFont = regular, size = 10) {
    const output: string[] = [];
    for (const para of text.split(/\r?\n/)) {
      let row = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = row ? row + " " + word : word;
        if (font.widthOfTextAtSize(next, size) <= width) { row = next; continue; }
        if (row) { output.push(row); row = ""; }
        for (const char of Array.from(word)) { if (row && font.widthOfTextAtSize(row + char, size) > width) { output.push(row); row = ""; } row += char; }
      }
      output.push(row || " ");
    }
    return output;
  }
  function right(text: string, edge: number, top: number, size = 10, font = regular, color = navy) {
    draw(text, edge - font.widthOfTextAtSize(text, size), top, size, font, color);
  }
  function newPage() {
    page = pdf.addPage([W, H]);
    const crownWidth = 54, crownHeight = crown.height * crownWidth / crown.width;
    page.drawImage(crown, { x: (W - crownWidth) / 2, y: H - 24 - crownHeight, width: crownWidth, height: crownHeight });
    const brandLines = wrap(brand, WIDTH, bold, 13);
    brandLines.forEach((value, index) => draw(value, (W - bold.widthOfTextAtSize(value, 13)) / 2, H - 29 - crownHeight - index * 17, 13, bold));
    right("Date : " + date, R, H - 37, 9, regular, muted);
    let top = H - 48 - crownHeight - brandLines.length * 17;
    if (market) {
      const authority = wrap(draft!.authority || "ROYAUME DU MAROC", 270, regular, 9.5);
      authority.forEach((value, index) => draw(value, L, top - index * 13.5, 9.5));
      right("APPEL D’OFFRES N° " + (draft!.tenderReference || ""), R, top - 25, 9.5, bold);
      right("MARCHÉ N° " + (draft!.marketReference || ""), R, top - 44, 9.5, bold);
      top -= Math.max(70, authority.length * 13.5 + 18);
      const objects = wrap("OBJET DE LA PRESTATION : " + contact.objet, WIDTH - 20, bold, 11);
      objects.forEach((value, index) => draw(value, (W - bold.widthOfTextAtSize(value, 11)) / 2, top - index * 16, 11, bold));
      top -= objects.length * 16 + 18;
    } else if (issued && request.kind === "facture" && draft!.rib) {
      const bankLines = wrap("RIB : " + draft!.rib + (draft!.bank ? " · " + draft!.bank : ""), WIDTH, regular, 9);
      bankLines.forEach((value, index) => draw(value, L, top - index * 13, 9, regular, muted));
      top -= bankLines.length * 13 + 14;
    }
    const titleSize = market ? 14 : issued && request.kind === "echantillons" ? 17 : 23;
    const titles = wrap(title, WIDTH, bold, titleSize);
    titles.forEach((value, index) => draw(value, market ? (W - bold.widthOfTextAtSize(value, titleSize)) / 2 : L, top - index * (titleSize + 5), titleSize, bold));
    top -= titles.length * (titleSize + 5) + 9;
    if (!market) {
      page.drawRectangle({ x: L, y: top - 30, width: WIDTH, height: 30, color: pale });
      draw(issued ? (request.kind === "facture" ? "REF FACTURE N°" : "RÉFÉRENCE DU DOCUMENT") : "RÉFÉRENCE DE LA DEMANDE", L + 10, top - 9, 8, bold, muted);
      right(reference, R - 10, top - 6, 13, bold, accent);
      top -= 30;
    }
    y = top - 16; contentTop = y;
  }
  function ensure(height: number) { if (y - height < bottom) newPage(); }
  function paragraph(text: string, size = 10, font = regular, color = navy, x = L, width = WIDTH) {
    for (const value of wrap(text, width, font, size)) { ensure(size * 1.4); draw(value, x, y, size, font, color); y -= size * 1.4; }
    y -= 6;
  }
  function section(text: string) { ensure(52); draw(text.toUpperCase(), L, y, 9, bold, accent); y -= 22; }
  newPage();
  if (!market) {
  section(issued || request.origin === "admin" ? "Client / Maître d’ouvrage" : "Destinataire de la demande");
  paragraph(contact.maitreOuvrage, 13, bold);
  if (!issued) {
  const emailLines = wrap("Email : " + contact.email, WIDTH - 176, regular, 9.5), phoneLines = wrap("Téléphone : " + contact.phone, 158, regular, 9.5);
  const contactHeight = Math.max(emailLines.length, phoneLines.length) * 13.3 + 7;
  ensure(contactHeight);
  emailLines.forEach((text, row) => draw(text, L, y - row * 13.3, 9.5, regular, muted));
  phoneLines.forEach((text, row) => draw(text, R - 158, y - row * 13.3, 9.5, regular, muted)); y -= contactHeight;
  }
  if (!issued && request.origin !== "admin") ["Nom et prénom : " + contact.name, "Ville : " + (contact.city || "Non renseignée")].forEach(text => paragraph(text, 9.5, regular, muted));
  if (contact.reference && (!issued || request.kind !== "facture")) paragraph((issued ? "Ref F:" : procurementLabel(contact.procurementType) + " · Référence :") + " " + contact.reference, 9.5, bold);
  if (contact.devisReference) paragraph("Référence du devis : " + contact.devisReference, 10, bold);
  const objectLines = wrap(contact.objet, WIDTH - 22, regular, 10);
  const objectHeight = 35 + objectLines.length * 14;
  if (objectHeight < contentTop - bottom) ensure(objectHeight + 15);
  if (objectHeight < contentTop - bottom) {
    page.drawRectangle({ x: L, y: y - objectHeight, width: WIDTH, height: objectHeight, color: pale });
    draw("OBJET DE LA PRESTATION", L + 11, y - 9, 8, bold, muted);
    objectLines.forEach((text, index) => draw(text, L + 11, y - 25 - index * 14, 10)); y -= objectHeight + 20;
  } else { section("Objet de la prestation"); paragraph(contact.objet); }
  }
  if (!issued) {
    section("Traitement de votre demande");
    paragraph("Votre demande de " + documentLabel(request.kind).toLowerCase() + " a bien été enregistrée. Le service administratif préparera le document et vous l’enverra par email.");
  } else {
    const invoice = request.kind === "facture", xs = invoice ? [L, L + 28, L + 273, L + 317, L + 355, L + 439, R] : [L, L + 32, L + 369, L + 435, R];
    const labels = invoice ? ["N°", "Désignation des prestations", "Unité", "Qté", "PU HT\n(MAD)", "Total HT\n(MAD)"] : ["N°", "Désignation des prestations", "Unité", "Quantité"];
    function header() {
      ensure(36); page.drawRectangle({ x: L, y: y - 34, width: WIDTH, height: 34, color: navy });
      labels.forEach((label, index) => label.split("\n").forEach((text, row) => draw(text, xs[index] + 6, y - (label.includes("\n") ? 5 : 11) - row * 11, 8, bold, white))); y -= 34;
    }
    function number(value: string, column: number, top: number, font = regular) {
      const width = xs[column + 1] - xs[column] - 12;
      const size = Math.min(9.5, width / Math.max(1, font.widthOfTextAtSize(value, 1)));
      right(value, xs[column + 1] - 6, top, size, font);
    }
    header();
    for (const [index, item] of draft!.items.entries()) {
      const rows = wrap(item.designation, xs[2] - xs[1] - 14, regular, 9.5); let cursor = 0;
      while (cursor < rows.length) {
        const prefix = cursor ? 15 : 0;
        if (y - (42 + prefix) < bottom) { newPage(); header(); }
        const count = Math.max(1, Math.min(rows.length - cursor, Math.floor((y - bottom - 18 - prefix) / 13.3)));
        const height = Math.max(42, 18 + prefix + count * 13.3);
        page.drawRectangle({ x: L, y: y - height, width: WIDTH, height, color: index % 2 ? pale : white });
        page.drawLine({ start: { x: L, y: y - height }, end: { x: R, y: y - height }, thickness: .55, color: line });
        if (cursor) draw("Article " + (index + 1) + " (suite)", xs[1] + 7, y - 8, 8.5, bold, muted);
        rows.slice(cursor, cursor + count).forEach((value, row) => draw(value, xs[1] + 7, y - 8 - prefix - row * 13.3, 9.5));
        if (!cursor) {
          draw(String(index + 1).padStart(2, "0"), L + 6, y - 10, 9, bold, muted);
          for (const [row, text] of wrap(item.unit, xs[3] - xs[2] - 10, regular, 9).entries()) draw(text, xs[2] + 5, y - 10 - row * 12, 9);
          number(String(item.quantity), 3, y - 10);
          if (invoice) { number(money(item.unitPrice).replace(/\s*MAD$/, ""), 4, y - 10); number(money(Math.round(Math.round(item.unitPrice * 100) * item.quantity) / 100).replace(/\s*MAD$/, ""), 5, y - 10, bold); }
        }
        cursor += count; y -= height;
      }
    }
    y -= 18;
    if (invoice) {
      const totals = documentTotals(draft!); ensure(140);
      for (const [label, amount] of [["Total HT", totals.subtotal], ["TVA " + draft!.taxRate + " %", totals.tax], ["Total TTC", totals.total]] as const) {
        const final = label === "Total TTC";
        page.drawRectangle({ x: L + 267, y: y - 30, width: WIDTH - 267, height: 30, color: final ? navy : pale });
        draw(label, L + 278, y - 8, 10, bold, final ? white : navy);
        right(money(amount).replace(/[\u00a0\u202f]/g, " "), R - 10, y - 7, 10.5, bold, final ? white : navy); y -= 30;
      }
      y -= 14; paragraph((market ? "Arrêté le présent bordereau à la somme TTC de : " : "Arrêtée la présente facture à la somme TTC de : ") + amountInWords(totals.total) + ".", 9.5, bold);

    }
  }
  ensure(80); y -= 4;
  draw("Cachet et signature", R - 195, y, 10, bold); y -= 70;
  drawDocumentFooters(pdf, regular);
  return pdf.save();
}
