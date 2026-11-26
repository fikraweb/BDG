import { rgb, type PDFDocument, type PDFFont } from "pdf-lib";

// Company details supplied by TAWZALA for every outgoing document page.
export const DOCUMENT_FOOTER_LINES = [
  "BDG",
];

export function documentFooterLayout(font: PDFFont, pageWidth: number) {
  const width = pageWidth - 72, size = 7.5, leading = 10.5, lines: string[] = [];
  for (const text of DOCUMENT_FOOTER_LINES) {
    let row = "";
    for (const word of text.split(/\s+/)) {
      const next = row ? row + " " + word : word;
      if (row && font.widthOfTextAtSize(next, size) > width) { lines.push(row); row = word; }
      else row = next;
    }
    if (row) lines.push(row);
  }
  const top = 25 + lines.length * leading;
  return { lines, size, leading, top, bottom: Math.max(94, top + 28) };
}

export function drawDocumentFooters(pdf: PDFDocument, font: PDFFont) {
  const muted = rgb(.36, .43, .49), rule = rgb(.77, .82, .87);
  const pages = pdf.getPages();
  for (const [index, page] of pages.entries()) {
    const width = page.getWidth(), layout = documentFooterLayout(font, width);
    page.drawLine({ start: { x: 36, y: layout.top + 12 }, end: { x: width - 36, y: layout.top + 12 }, thickness: .65, color: rule });
    layout.lines.forEach((text, line) => page.drawText(text, { x: (width - font.widthOfTextAtSize(text, layout.size)) / 2, y: layout.top - line * layout.leading - layout.size, font, size: layout.size, color: muted }));
    const number = "Page " + (index + 1) + " / " + pages.length;
    page.drawText(number, { x: width - 36 - font.widthOfTextAtSize(number, 7), y: 17, font, size: 7, color: muted });
  }
}
