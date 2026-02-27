// labels-next/components/LabelsApp.client.tsx

"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { PdfSettings, PreviewSettings, RegistryItem } from "@/lib/types";
import {
  deleteItemAction,
  generatePdfAction,
  getItemPngBase64Action,
  renderPreviewAction,
  savePngItemAction,
} from "@/lib/actions";
import ItemsPanel from "./ItemsPanel.client";
import SettingsPanel from "./SettingsPanel.client";
import PreviewPanel from "./PreviewPanel.client";
import Tabs, { TabKey } from "./Tabs.client";
import ToastHost, { useToasts } from "./ToastHost.client";
import { gridSpec, pageSpec } from "@/lib/constants";

function defaultPdfSettings(): PdfSettings {
  return {
    pages: 1,
    leftMarginMm: 2.5,
    topMarginMm: 0.0,
    colGapMm: 0.0,
    rowGapMm: 0.0,
    repeatPerCell: 4,
    imageScale: 0.85,
    imgPadMm: 0.5,
    imageFitMode: "contain",
    drawCellBoxes: true,
    strokeWidthPt: 0.7,
    drawInnerImageBox: false,
    innerBoxStrokePt: 0.5,
    drawCutGuideLine: false,
    cutLineStrokePt: 0.4,
  };
}

function defaultPreviewSettings(): PreviewSettings {
  return { showPreview: true, previewDpi: 200, fullPage: false };
}

// কেন: base64 → Blob URL (pdf/jpg/thumbnail) preview
function base64ToObjectUrl(base64: string, mime: string): string {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  return URL.createObjectURL(blob);
}

function revokeIfAny(url: string | null): void {
  if (url) URL.revokeObjectURL(url);
}

export default function LabelsApp({ initialItems }: Readonly<{ initialItems: RegistryItem[] }>) {
  const [items, setItems] = useState<RegistryItem[]>(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(initialItems[0]?.id ?? null);
  const [query, setQuery] = useState<string>("");

  const [tab, setTab] = useState<TabKey>("items");

  const [pdfSettings, setPdfSettings] = useState<PdfSettings>(() => defaultPdfSettings());
  const [previewSettings, setPreviewSettings] = useState<PreviewSettings>(() => defaultPreviewSettings());

  const [busy, setBusy] = useState<boolean>(false);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [jpgUrl, setJpgUrl] = useState<string | null>(null);

  // ✅ NEW: selected item thumbnail URL
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  // ✅ Toast system
  const { toasts, push, dismiss } = useToasts();

  const filtered = useMemo(() => {
    // কেন: simple case-insensitive search
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.name.toLowerCase().includes(q));
  }, [items, query]);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return items.find((x) => x.id === selectedId) ?? null;
  }, [items, selectedId]);

  // ✅ NEW: selectedId change হলে thumbnail load
  useEffect(() => {
    let alive = true;

    async function loadThumb(): Promise<void> {
      // কেন: selectedId না থাকলে thumbnail clear
      revokeIfAny(thumbUrl);
      setThumbUrl(null);

      if (!selectedId) return;

      try {
        const res = await getItemPngBase64Action(selectedId);
        if (!alive) return;

        if (!res.ok || !res.data) {
          // কেন: thumbnail failure critical না—silent + toast info
          push({ kind: "info", title: "Thumbnail", message: res.error ?? "Failed to load thumbnail" });
          return;
        }

        const url = base64ToObjectUrl(res.data.pngBase64, "image/png");
        setThumbUrl(url);
      } catch {
        // ignore
      }
    }

    void loadThumb();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function handleUpload(name: string, fileBase64: string): Promise<void> {
    setBusy(true);

    try {
      const res = await savePngItemAction({ name, fileBase64 });

      if (!res.ok) throw new Error(res.error ?? "Save failed");
      const item = res.data;
      if (!item) throw new Error("Save failed: no item returned");

      setItems((prev) => [...prev, item]);
      setSelectedId(item.id);

      push({ kind: "success", title: "Saved", message: `PNG item "${item.name}" saved ✅` });
      setTab("generate"); // কেন: save শেষে user সাধারণত generate করতে চায়
    } catch (e) {
      push({ kind: "error", title: "Upload failed", message: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSelected(): Promise<void> {
    if (!selectedId) return;
    setBusy(true);

    try {
      const targetName = selectedItem?.name ?? "Item";

      const res = await deleteItemAction(selectedId);
      if (!res.ok) throw new Error(res.error ?? "Delete failed");

      // কেন: items থেকে remove
      setItems((prev) => prev.filter((x) => x.id !== selectedId));

      // কেন: next selection choose (filtered থেকে first)
      const next = items.filter((x) => x.id !== selectedId)[0]?.id ?? null;
      setSelectedId(next);

      // কেন: generated assets clear
      revokeIfAny(pdfUrl); setPdfUrl(null);
      revokeIfAny(jpgUrl); setJpgUrl(null);
      revokeIfAny(thumbUrl); setThumbUrl(null);

      push({ kind: "success", title: "Deleted", message: `"${targetName}" deleted ✅` });
      setTab("items");
    } catch (e) {
      push({ kind: "error", title: "Delete failed", message: e instanceof Error ? e.message : "Delete failed" });
    } finally {
      setBusy(false);
    }
  }

  async function handleGeneratePdf(): Promise<void> {
    if (!selectedId) {
      push({ kind: "error", title: "Select item", message: "আগে একটা item select করুন।" });
      return;
    }

    setBusy(true);

    try {
      const res = await generatePdfAction({ itemId: selectedId, settings: pdfSettings });

      if (!res.ok) throw new Error(res.error ?? "PDF failed");
      const data = res.data;
      if (!data) throw new Error("PDF failed: no data returned");

      revokeIfAny(pdfUrl);
      const url = base64ToObjectUrl(data.pdfBase64, "application/pdf");
      setPdfUrl(url);

      push({ kind: "success", title: "PDF Ready", message: `Pages: ${pdfSettings.pages}` });
      setTab("preview");
    } catch (e) {
      push({ kind: "error", title: "PDF failed", message: e instanceof Error ? e.message : "PDF failed" });
      revokeIfAny(pdfUrl);
      setPdfUrl(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleRenderPreview(): Promise<void> {
    if (!selectedId) {
      push({ kind: "error", title: "Select item", message: "Preview দেখতে একটি item select করুন।" });
      return;
    }
    if (!previewSettings.showPreview) {
      push({ kind: "info", title: "Preview disabled", message: "Settings এ preview enable করুন।" });
      return;
    }

    setBusy(true);

    try {
      const res = await renderPreviewAction({
        itemId: selectedId,
        settings: pdfSettings,
        dpi: previewSettings.previewDpi,
        fullPage: previewSettings.fullPage,
      });

      if (!res.ok) throw new Error(res.error ?? "Preview failed");
      const data = res.data;
      if (!data) throw new Error("Preview failed: no data returned");

      revokeIfAny(jpgUrl);
      const url = base64ToObjectUrl(data.jpgBase64, "image/jpeg");
      setJpgUrl(url);

      push({ kind: "success", title: "Preview Ready", message: `DPI: ${previewSettings.previewDpi}` });
      setTab("preview");
    } catch (e) {
      push({ kind: "error", title: "Preview failed", message: e instanceof Error ? e.message : "Preview failed" });
      revokeIfAny(jpgUrl);
      setJpgUrl(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ToastHost toasts={toasts} onDismiss={dismiss} />

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Left */}
        <div className="space-y-6">
          {/* Top bar: Tabs + Selected thumbnail */}
          <div className="card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Tabs value={tab} onChange={setTab} />

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-slate-500">Selected</p>
                  <p className="text-sm font-semibold">
                    {selectedItem ? selectedItem.name : "None"}
                  </p>
                </div>

                <div className="h-12 w-12 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  {/* কেন: thumbUrl না থাকলে placeholder */}
                  {thumbUrl ? (
                    <img src={thumbUrl} alt="Selected thumbnail" className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                      —
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="divider" />

            {/* Tab Contents */}
            {tab === "items" ? (
              <ItemsPanel
                items={filtered}
                allItemsCount={items.length}
                query={query}
                onQueryChange={setQuery}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onUpload={handleUpload}
                onDeleteSelected={handleDeleteSelected}
                busy={busy}
              />
            ) : null}

            {tab === "generate" ? (
              <div className="space-y-4">
                <div>
                  <h2 className="card-title">Generate</h2>
                  <p className="card-subtitle">
                    Page: {pageSpec.pageWMm}×{pageSpec.pageHMm}mm • Grid: {gridSpec.cols}×{gridSpec.rows}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn btn-primary"
                    onClick={() => void handleGeneratePdf()}
                    disabled={busy || !selectedItem}
                  >
                    ✅ Generate PDF
                  </button>

                  <button
                    className="btn"
                    onClick={() => void handleRenderPreview()}
                    disabled={busy || !selectedItem || !previewSettings.showPreview}
                  >
                    🖼️ Render Preview
                  </button>

                  <span className="badge">
                    {busy ? "Working..." : selectedItem ? "Ready" : "Select item"}
                  </span>
                </div>

                {pdfUrl ? (
                  <div className="space-y-2">
                    <a
                      className="btn"
                      href={pdfUrl}
                      download={`labels_95x150_9x3_pages${pdfSettings.pages}.pdf`}
                    >
                      ⬇️ Download PDF
                    </a>
                    <p className="help">PDF generate হয়েছে—Preview tab এ গিয়ে iframe এ দেখো।</p>
                  </div>
                ) : (
                  <p className="help">Generate PDF চাপলে download link তৈরি হবে।</p>
                )}
              </div>
            ) : null}

            {tab === "preview" ? (
              <div className="space-y-4">
                <div>
                  <h2 className="card-title">Preview</h2>
                  <p className="card-subtitle">PDF + JPG preview এখানে দেখাবে।</p>
                </div>

                {pdfUrl ? (
                  <div className="space-y-2">
                    <a
                      className="btn"
                      href={pdfUrl}
                      download={`labels_95x150_9x3_pages${pdfSettings.pages}.pdf`}
                    >
                      ⬇️ Download PDF
                    </a>

                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <iframe className="h-88 w-full" src={pdfUrl} title="PDF Preview" />
                    </div>
                  </div>
                ) : (
                  <p className="help">PDF নেই—Generate tab থেকে PDF বানাও।</p>
                )}

                <PreviewPanel jpgUrl={jpgUrl} />
              </div>
            ) : null}
          </div>
        </div>

        {/* Right (Sticky settings) */}
        <div className="lg:sticky lg:top-6 h-fit">
          <div className="card p-5">
            <SettingsPanel
              pdfSettings={pdfSettings}
              onPdfSettingsChange={setPdfSettings}
              previewSettings={previewSettings}
              onPreviewSettingsChange={setPreviewSettings}
            />
          </div>
        </div>
      </div>
    </>
  );
}