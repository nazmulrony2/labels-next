import fs from "fs/promises";
import sharp from "sharp";
import { gridSpec, pageSpec } from "./constants";
import type { ImageFitMode, PdfSettings, RegistryItem } from "./types";

// ✅ কেন: mm → px (DPI based) conversion
function mmToPx(mm: number, dpi: number): number {
  const inches = mm / 25.4;
  return Math.max(1, Math.round(inches * dpi));
}

// ✅ কেন: “contain” fit size
function fitContainPx(imgW: number, imgH: number, boxW: number, boxH: number): { w: number; h: number } {
  const scale = Math.min(boxW / imgW, boxH / imgH);
  return { w: Math.max(1, Math.round(imgW * scale)), h: Math.max(1, Math.round(imgH * scale)) };
}

// ✅ কেন: first page preview JPG bytes generate
export async function renderPreviewJpg(params: {
  item: RegistryItem;
  settings: PdfSettings;
  dpi: number;
  fullPage: boolean;
}): Promise<Uint8Array> {
  const { item, settings, dpi, fullPage } = params;

  const pageWpx = mmToPx(pageSpec.pageWMm, dpi);
  const pageHpx = mmToPx(pageSpec.pageHMm, dpi);

  const colWpx = mmToPx(gridSpec.colWMm, dpi);
  const rowHpx = mmToPx(gridSpec.rowHMm, dpi);

  const leftPx = mmToPx(settings.leftMarginMm, dpi);
  const topPx = mmToPx(settings.topMarginMm, dpi);
  const colGapPx = mmToPx(settings.colGapMm, dpi);
  const rowGapPx = mmToPx(settings.rowGapMm, dpi);

  const padPx = mmToPx(settings.imgPadMm, dpi);

  // ✅ কেন: preview canvas base
  const baseW = fullPage ? pageWpx : Math.max(1, gridSpec.cols * colWpx + (gridSpec.cols - 1) * colGapPx + mmToPx(10, dpi));
  const baseH = fullPage ? pageHpx : Math.max(1, gridSpec.rows * rowHpx + (gridSpec.rows - 1) * rowGapPx + mmToPx(10, dpi));

  // ✅ কেন: white background canvas
  let canvas = sharp({
    create: {
      width: baseW,
      height: baseH,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  });

  // ✅ কেন: PNG load
  const png = await fs.readFile(item.value);
  const pngMeta = await sharp(png).metadata();
  const imgW = pngMeta.width ?? 1;
  const imgH = pngMeta.height ?? 1;

  const originX = fullPage ? leftPx : mmToPx(5, dpi);
  const originY = fullPage ? topPx : mmToPx(5, dpi);

  // ✅ কেন: border thickness approx
  const borderPx = Math.max(1, Math.round((settings.strokeWidthPt / 72) * dpi));
  const innerBorderPx = Math.max(1, Math.round((settings.innerBoxStrokePt / 72) * dpi));
  const cutPx = Math.max(1, Math.round((settings.cutLineStrokePt / 72) * dpi));

  // ✅ কেন: overlay list (sharp composite)
  const overlays: Array<{ input: Buffer; left: number; top: number }> = [];

  // ✅ কেন: helper to make rectangle svg (borders)
  const rectSvg = (w: number, h: number, strokeW: number) => Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${strokeW / 2}" y="${strokeW / 2}" width="${w - strokeW}" height="${h - strokeW}"
        fill="none" stroke="black" stroke-width="${strokeW}" />
    </svg>`
  );

  // ✅ কেন: helper to make line svg
  const lineSvg = (w: number, y: number, strokeW: number) => Buffer.from(
    `<svg width="${w}" height="${Math.max(1, y + strokeW)}" xmlns="http://www.w3.org/2000/svg">
      <line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="black" stroke-width="${strokeW}" />
    </svg>`
  );

  for (let r = 0; r < gridSpec.rows; r++) {
    for (let c = 0; c < gridSpec.cols; c++) {
      const x = originX + c * (colWpx + colGapPx);
      const y = originY + r * (rowHpx + rowGapPx);

      // ✅ কেন: cell border
      if (settings.drawCellBoxes) {
        overlays.push({ input: rectSvg(colWpx, rowHpx, borderPx), left: x, top: y });
      }

      // ✅ কেন: repeat positions inside cell
      const paddingYpx = Math.max(mmToPx(2, dpi), Math.round(0.08 * rowHpx));
      const usableHpx = Math.max(1, rowHpx - 2 * paddingYpx);

      for (let i = 0; i < settings.repeatPerCell; i++) {
        const frac = settings.repeatPerCell === 1 ? 0.5 : i / (settings.repeatPerCell - 1);
        const ty = y + rowHpx - paddingYpx - Math.round(usableHpx * frac);
        const tx = x + Math.floor(colWpx / 2);

        const boxWpx = Math.round(colWpx * settings.imageScale);
        const boxHpx = Math.round((rowHpx / Math.max(1, settings.repeatPerCell)) * settings.imageScale);

        const innerWpx = Math.max(1, boxWpx - 2 * padPx);
        const innerHpx = Math.max(1, boxHpx - 2 * padPx);

        const innerLeft = tx - Math.floor(innerWpx / 2);
        const innerTop = ty - Math.floor(innerHpx / 2);

        // ✅ কেন: debug inner box
        if (settings.drawInnerImageBox) {
          overlays.push({ input: rectSvg(innerWpx, innerHpx, innerBorderPx), left: innerLeft, top: innerTop });
        }

        // ✅ কেন: cut guide line
        if (settings.drawCutGuideLine) {
          overlays.push({ input: lineSvg(colWpx, ty - y, cutPx), left: x, top: y });
        }

        // ✅ কেন: image fit behavior (cover/contain)
        const fitMode: ImageFitMode = settings.imageFitMode;

        if (fitMode === "cover") {
          // ✅ কেন: cover -> sharp.resize cover + center crop
          const fitted = await sharp(png)
            .resize(innerWpx, innerHpx, { fit: "cover", position: "centre" })
            .flatten({ background: "#ffffff" })
            .toBuffer();
          overlays.push({ input: fitted, left: innerLeft, top: innerTop });
        } else {
          // ✅ কেন: contain -> resize then center in white box
          const { w, h } = fitContainPx(imgW, imgH, innerWpx, innerHpx);
          const resized = await sharp(png)
            .resize(w, h, { fit: "inside" })
            .toBuffer();

          const box = await sharp({
            create: {
              width: innerWpx,
              height: innerHpx,
              channels: 3,
              background: { r: 255, g: 255, b: 255 },
            },
          })
            .composite([{ input: resized, left: Math.floor((innerWpx - w) / 2), top: Math.floor((innerHpx - h) / 2) }])
            .jpeg({ quality: 92 })
            .toBuffer();

          overlays.push({ input: box, left: innerLeft, top: innerTop });
        }
      }
    }
  }

  canvas = canvas.composite(overlays);

  const out = await canvas.jpeg({ quality: 92 }).toBuffer();
  return new Uint8Array(out);
}