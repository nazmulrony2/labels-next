// labels-next/lib/pdf.ts

import fs from "fs/promises";
import { PDFDocument, rgb } from "pdf-lib";
import { pageSpec, gridSpec } from "./constants";
import type { PdfSettings, RegistryItem } from "./types";

// ✅ কেন: mm → points conversion (ReportLab এর mm like)
// 1 inch = 25.4 mm, 1 point = 1/72 inch
function mmToPt(mm: number): number {
  return (mm / 25.4) * 72.0;
}

// ✅ কেন: contain fit -> distortion ছাড়া box এর ভিতরে fit
function fitContain(imgW: number, imgH: number, boxW: number, boxH: number): { w: number; h: number } {
  if (imgW <= 0 || imgH <= 0) return { w: boxW, h: boxH };
  const scale = Math.min(boxW / imgW, boxH / imgH);
  return { w: imgW * scale, h: imgH * scale };
}

// ✅ কেন: grid boundary validate (Streamlit এর মতোই early error)
function validateGridFits(settings: PdfSettings): void {
  const pageW = mmToPt(pageSpec.pageWMm);
  const pageH = mmToPt(pageSpec.pageHMm);

  const colW = mmToPt(gridSpec.colWMm);
  const rowH = mmToPt(gridSpec.rowHMm);

  const left = mmToPt(settings.leftMarginMm);
  const top = mmToPt(settings.topMarginMm);
  const colGap = mmToPt(settings.colGapMm);
  const rowGap = mmToPt(settings.rowGapMm);

  const gridTotalW = gridSpec.cols * colW + (gridSpec.cols - 1) * colGap;
  const gridTotalH = gridSpec.rows * rowH + (gridSpec.rows - 1) * rowGap;

  // ✅ কেন: page boundary ছাড়ালে print এ কেটে যাবে
  if (left + gridTotalW > pageW + 0.001) {
    throw new Error("Grid width পেজের বাইরে যাচ্ছে। Left margin/Column gap কমান।");
  }
  if (top + gridTotalH > pageH + 0.001) {
    throw new Error("Grid height পেজের বাইরে যাচ্ছে। Top margin/Row gap কমান।");
  }
}

// ✅ কেন: PDF bytes generate — multi-page grid + repeat per cell
export async function generatePdfBytes(params: {
  item: RegistryItem;
  settings: PdfSettings;
}): Promise<Uint8Array> {
  const { item, settings } = params;

  if (settings.pages < 1) throw new Error("Pages কমপক্ষে 1 হতে হবে।");
  if (item.type !== "image") throw new Error("PNG-only mode: item type অবশ্যই image হতে হবে।");

  validateGridFits(settings);

  // ✅ কেন: PNG file পড়ি (server side)
  const pngBytes = await fs.readFile(item.value);

  const pdfDoc = await PDFDocument.create();

  // ✅ কেন: image embed একবারই—সব page এ reuse করলে perf ভালো
  const pngImage = await pdfDoc.embedPng(pngBytes);
  const imgW = pngImage.width;
  const imgH = pngImage.height;

  const pageW = mmToPt(pageSpec.pageWMm);
  const pageH = mmToPt(pageSpec.pageHMm);

  const colW = mmToPt(gridSpec.colWMm);
  const rowH = mmToPt(gridSpec.rowHMm);

  const left = mmToPt(settings.leftMarginMm);
  const top = mmToPt(settings.topMarginMm);
  const colGap = mmToPt(settings.colGapMm);
  const rowGap = mmToPt(settings.rowGapMm);

  const pad = mmToPt(settings.imgPadMm);

  for (let p = 0; p < settings.pages; p++) {
    const page = pdfDoc.addPage([pageW, pageH]);

    // ✅ কেন: Streamlit এ y_top = page_h - top_margin
    const x0 = left;
    const yTop = pageH - top;

    for (let r = 0; r < gridSpec.rows; r++) {
      for (let c = 0; c < gridSpec.cols; c++) {
        const x = x0 + c * (colW + colGap);
        const y = yTop - (r + 1) * rowH - r * rowGap;

        // ✅ কেন: cell border optional
        if (settings.drawCellBoxes) {
          page.drawRectangle({
            x,
            y,
            width: colW,
            height: rowH,
            borderColor: rgb(0, 0, 0),
            borderWidth: settings.strokeWidthPt,
          });
        }

        // ✅ কেন: cell এর ভিতরে vertically repeat positions
        const paddingY = Math.max(mmToPt(2.0), 0.08 * rowH);
        const usableH = Math.max(1.0, rowH - 2 * paddingY);

        for (let i = 0; i < settings.repeatPerCell; i++) {
          const frac = settings.repeatPerCell === 1 ? 0.5 : i / (settings.repeatPerCell - 1);

          // ✅ কেন: ty calculation Streamlit এর মতো
          const ty = y + rowH - paddingY - usableH * frac;
          const tx = x + colW / 2.0;

          // ✅ কেন: target box size (scale applied)
          const boxW = colW * settings.imageScale;
          const boxH = (rowH / Math.max(1, settings.repeatPerCell)) * settings.imageScale;

          // ✅ কেন: padding apply করে inner box shrink
          const innerW = Math.max(1.0, boxW - 2 * pad);
          const innerH = Math.max(1.0, boxH - 2 * pad);

          // ✅ কেন: PDF side এ “true cover crop” কঠিন, তাই contain approach (Streamlit মন্তব্য অনুযায়ী)
          const { w: drawW, h: drawH } = fitContain(imgW, imgH, innerW, innerH);

          // ✅ কেন: center align
          const ix = tx - drawW / 2.0;
          const iy = ty - drawH / 2.0;

          // ✅ কেন: inner debug box optional
          if (settings.drawInnerImageBox) {
            page.drawRectangle({
              x: tx - innerW / 2.0,
              y: ty - innerH / 2.0,
              width: innerW,
              height: innerH,
              borderColor: rgb(0, 0, 0),
              borderWidth: settings.innerBoxStrokePt,
            });
          }

          // ✅ কেন: cut guide line optional
          if (settings.drawCutGuideLine) {
            page.drawLine({
              start: { x, y: ty },
              end: { x: x + colW, y: ty },
              thickness: settings.cutLineStrokePt,
              color: rgb(0, 0, 0),
            });
          }

          // ✅ কেন: draw image
          page.drawImage(pngImage, {
            x: ix,
            y: iy,
            width: drawW,
            height: drawH,
          });
        }
      }
    }
  }

  return pdfDoc.save();
}