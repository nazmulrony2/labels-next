// labels-next/components/SettingsPanel.client.tsx
"use client";

import React from "react";
import type { PdfSettings, PreviewSettings } from "@/lib/types";

function toNumber(v: string, fallback: number): number {
  // কেন: input থেকে string আসে; safe number parsing
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function SettingsPanel(props: Readonly<{
  pdfSettings: PdfSettings;
  onPdfSettingsChange: (next: PdfSettings) => void;
  previewSettings: PreviewSettings;
  onPreviewSettingsChange: (next: PreviewSettings) => void;
}>) {
  const s = props.pdfSettings;
  const p = props.previewSettings;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="card-title">⚙️ Settings</h2>
        <p className="card-subtitle">PDF + Preview controls (Streamlit sidebar equivalent)।</p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">PDF</h3>

        <label className="text-sm font-medium">Pages</label>
        <input
          className="input"
          type="number"
          min={1}
          max={500}
          value={s.pages}
          onChange={(e) => props.onPdfSettingsChange({ ...s, pages: toNumber(e.target.value, 1) })}
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Left Margin (mm)</label>
            <input
              className="input"
              type="number"
              step={0.5}
              min={0}
              max={30}
              value={s.leftMarginMm}
              onChange={(e) =>
                props.onPdfSettingsChange({ ...s, leftMarginMm: toNumber(e.target.value, s.leftMarginMm) })
              }
            />
          </div>
          <div>
            <label className="text-sm font-medium">Top Margin (mm)</label>
            <input
              className="input"
              type="number"
              step={0.5}
              min={0}
              max={30}
              value={s.topMarginMm}
              onChange={(e) =>
                props.onPdfSettingsChange({ ...s, topMarginMm: toNumber(e.target.value, s.topMarginMm) })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Column Gap (mm)</label>
            <input
              className="input"
              type="number"
              step={0.5}
              min={0}
              max={10}
              value={s.colGapMm}
              onChange={(e) =>
                props.onPdfSettingsChange({ ...s, colGapMm: toNumber(e.target.value, s.colGapMm) })
              }
            />
          </div>
          <div>
            <label className="text-sm font-medium">Row Gap (mm)</label>
            <input
              className="input"
              type="number"
              step={0.5}
              min={0}
              max={10}
              value={s.rowGapMm}
              onChange={(e) =>
                props.onPdfSettingsChange({ ...s, rowGapMm: toNumber(e.target.value, s.rowGapMm) })
              }
            />
          </div>
        </div>

        <label className="text-sm font-medium">Repeat per cell</label>
        <input
          className="input"
          type="number"
          min={1}
          max={20}
          value={s.repeatPerCell}
          onChange={(e) =>
            props.onPdfSettingsChange({ ...s, repeatPerCell: toNumber(e.target.value, s.repeatPerCell) })
          }
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">PNG</h3>

        <label className="text-sm font-medium">PNG scale inside cell</label>
        <input
          className="w-full"
          type="range"
          min={0.2}
          max={1.2}
          step={0.05}
          value={s.imageScale}
          onChange={(e) => props.onPdfSettingsChange({ ...s, imageScale: toNumber(e.target.value, s.imageScale) })}
        />
        <div className="help">Scale: {s.imageScale.toFixed(2)}</div>

        <label className="text-sm font-medium">PNG padding (mm)</label>
        <input
          className="input"
          type="number"
          step={0.1}
          min={0}
          max={5}
          value={s.imgPadMm}
          onChange={(e) => props.onPdfSettingsChange({ ...s, imgPadMm: toNumber(e.target.value, s.imgPadMm) })}
        />

        <label className="text-sm font-medium">Preview fit mode</label>
        <select
          className="select"
          value={s.imageFitMode}
          onChange={(e) =>
            props.onPdfSettingsChange({
              ...s,
              imageFitMode: e.target.value === "cover" ? "cover" : "contain",
            })
          }
        >
          <option value="contain">contain</option>
          <option value="cover">cover</option>
        </select>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Borders</h3>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={s.drawCellBoxes}
            onChange={(e) => props.onPdfSettingsChange({ ...s, drawCellBoxes: e.target.checked })}
          />
          Draw cell border
        </label>

        <label className="text-sm font-medium">Cell border thickness (pt)</label>
        <input
          className="input"
          type="number"
          step={0.1}
          min={0.1}
          max={3}
          value={s.strokeWidthPt}
          onChange={(e) =>
            props.onPdfSettingsChange({ ...s, strokeWidthPt: toNumber(e.target.value, s.strokeWidthPt) })
          }
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={s.drawInnerImageBox}
            onChange={(e) => props.onPdfSettingsChange({ ...s, drawInnerImageBox: e.target.checked })}
          />
          Show inner image box (debug)
        </label>

        <label className="text-sm font-medium">Inner box thickness (pt)</label>
        <input
          className="input"
          type="number"
          step={0.1}
          min={0.1}
          max={3}
          value={s.innerBoxStrokePt}
          onChange={(e) =>
            props.onPdfSettingsChange({ ...s, innerBoxStrokePt: toNumber(e.target.value, s.innerBoxStrokePt) })
          }
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={s.drawCutGuideLine}
            onChange={(e) => props.onPdfSettingsChange({ ...s, drawCutGuideLine: e.target.checked })}
          />
          Cut guide line at each repeat Y
        </label>

        <label className="text-sm font-medium">Cut line thickness (pt)</label>
        <input
          className="input"
          type="number"
          step={0.1}
          min={0.1}
          max={3}
          value={s.cutLineStrokePt}
          onChange={(e) =>
            props.onPdfSettingsChange({ ...s, cutLineStrokePt: toNumber(e.target.value, s.cutLineStrokePt) })
          }
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Preview</h3>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={p.showPreview}
            onChange={(e) => props.onPreviewSettingsChange({ ...p, showPreview: e.target.checked })}
          />
          Enable preview
        </label>

        <label className="text-sm font-medium">Preview DPI</label>
        <input
          className="input"
          type="number"
          min={120}
          max={400}
          step={20}
          value={p.previewDpi}
          onChange={(e) => props.onPreviewSettingsChange({ ...p, previewDpi: toNumber(e.target.value, p.previewDpi) })}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={p.fullPage}
            onChange={(e) => props.onPreviewSettingsChange({ ...p, fullPage: e.target.checked })}
          />
          Full page preview (slower)
        </label>
      </section>
    </div>
  );
}