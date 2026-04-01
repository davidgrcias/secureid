import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type PdfFieldPlacement = {
  pageNumber: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  label: string;
};

function toPdfCoordinate(value: number, max: number): number {
  if (value <= 100) {
    return (value / 100) * max;
  }

  return Math.min(Math.max(value, 0), max);
}

function toPdfSize(value: number, max: number): number {
  if (value <= 100) {
    return (value / 100) * max;
  }

  return Math.min(Math.max(value, 1), max);
}

export async function applySignatureFieldsToPdf(input: {
  sourcePath: string;
  outputPath: string;
  signerName: string;
  signedAtIso: string;
  fields: PdfFieldPlacement[];
}): Promise<void> {
  const sourceBytes = await fs.readFile(input.sourcePath);
  const pdfDoc = await PDFDocument.load(sourceBytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (const field of input.fields) {
    const page = pages[field.pageNumber - 1] ?? pages[0];
    if (!page) {
      continue;
    }

    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const width = toPdfSize(field.width, pageWidth);
    const height = toPdfSize(field.height, pageHeight);
    const x = toPdfCoordinate(field.positionX, pageWidth);

    // Convert top-left based coordinates into PDF bottom-left coordinates.
    const topOffset = toPdfCoordinate(field.positionY, pageHeight);
    const y = Math.max(pageHeight - topOffset - height, 0);

    page.drawRectangle({
      x,
      y,
      width,
      height,
      borderWidth: 1,
      borderColor: rgb(0.05, 0.27, 0.69),
      color: rgb(0.92, 0.95, 1)
    });

    const signatureText = field.label || `Signed by ${input.signerName}`;
    const stampText = `${signatureText} | ${new Date(input.signedAtIso).toLocaleString("id-ID")}`;

    page.drawText(stampText, {
      x: x + 4,
      y: y + Math.max(height / 2 - 5, 2),
      size: 8,
      font,
      color: rgb(0.07, 0.16, 0.32),
      maxWidth: Math.max(width - 8, 20)
    });
  }

  const signedBytes = await pdfDoc.save();
  await fs.mkdir(path.dirname(input.outputPath), { recursive: true });
  await fs.writeFile(input.outputPath, signedBytes);
}
