"use server";

import crypto from "crypto";
import fs from "fs/promises";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import type { PdfSettings, RegistryItem } from "./types";
import { ensureDir, loadItems, saveItems, savePngFile, deleteFileIfExists } from "./storage";
import { storageSpec } from "./constants";
import { generatePdfBytes } from "./pdf";
import { renderPreviewJpg } from "./preview";

/**
 * ✅ কেন: Common action result type
 * - data optional হওয়ায় client-side এ guard করে নিতে হয়
 */
export interface ActionResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

/**
 * ✅ কেন: Add item validation (Streamlit st.error equivalent)
 */
const addItemSchema = z.object({
  name: z.string().trim().min(1, "Name এবং PNG আপলোড দুটোই লাগবে।").max(80),
  fileBase64: z.string().min(1),
});

/**
 * ✅ কেন: Server-side registry read (initial page render + refresh)
 */
export async function getItemsAction(): Promise<ActionResult<RegistryItem[]>> {
  try {
    await ensureDir(storageSpec.itemsDir);
    const items = await loadItems();
    return { ok: true, data: items };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load items" };
  }
}

/**
 * ✅ কেন: PNG item save (file + registry)
 */
export async function savePngItemAction(input: {
  name: string;
  fileBase64: string; // "data:image/png;base64,..." or raw base64
}): Promise<ActionResult<RegistryItem>> {
  try {
    const parsed = addItemSchema.parse(input);

    // ✅ কেন: dataURL হলে header বাদ দেই
    const base64 = parsed.fileBase64.includes(",")
      ? parsed.fileBase64.split(",")[1]
      : parsed.fileBase64;

    const fileBytes = Buffer.from(base64, "base64");
    if (fileBytes.length < 8) throw new Error("Invalid PNG data");

    const id = crypto.randomUUID();
    const idShort = id.slice(0, 8);

    const filePath = await savePngFile({
      fileBytes: new Uint8Array(fileBytes),
      name: parsed.name,
      idShort,
    });

    const newItem: RegistryItem = {
      id,
      name: parsed.name,
      type: "image",
      value: filePath,
    };

    const items = await loadItems();
    await saveItems([...items, newItem]);

    // ✅ কেন: server component page কে refresh করতে
    revalidatePath("/");

    return { ok: true, data: newItem };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
}

/**
 * ✅ কেন: Delete selected item (registry update + file delete)
 */
export async function deleteItemAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const items = await loadItems();
    const target = items.find((x) => x.id === id);
    if (!target) return { ok: false, error: "Item not found" };

    const rest = items.filter((x) => x.id !== id);
    await saveItems(rest);

    // ✅ কেন: file delete safe (না থাকলেও ignore)
    await deleteFileIfExists(target.value);

    revalidatePath("/");
    return { ok: true, data: { id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed" };
  }
}

/**
 * ✅ কেন: PDF generate (binary → base64 for client download)
 */
export async function generatePdfAction(params: {
  itemId: string;
  settings: PdfSettings;
}): Promise<ActionResult<{ pdfBase64: string }>> {
  try {
    const items = await loadItems();
    const item = items.find((x) => x.id === params.itemId);
    if (!item) return { ok: false, error: "আগে একটা item select করুন।" };

    const bytes = await generatePdfBytes({ item, settings: params.settings });
    const pdfBase64 = Buffer.from(bytes).toString("base64");

    return { ok: true, data: { pdfBase64 } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "PDF generation failed" };
  }
}

/**
 * ✅ কেন: Preview JPG generate (binary → base64 for client img)
 */
export async function renderPreviewAction(params: {
  itemId: string;
  settings: PdfSettings;
  dpi: number;
  fullPage: boolean;
}): Promise<ActionResult<{ jpgBase64: string }>> {
  try {
    const items = await loadItems();
    const item = items.find((x) => x.id === params.itemId);
    if (!item) return { ok: false, error: "Preview দেখতে একটি item select করুন।" };

    const bytes = await renderPreviewJpg({
      item,
      settings: params.settings,
      dpi: params.dpi,
      fullPage: params.fullPage,
    });

    const jpgBase64 = Buffer.from(bytes).toString("base64");
    return { ok: true, data: { jpgBase64 } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Preview failed" };
  }
}

/**
 * ✅ কেন: Selected item thumbnail (PNG) — server থেকে file read করে base64 পাঠাই
 */
export async function getItemPngBase64Action(
  itemId: string
): Promise<ActionResult<{ pngBase64: string }>> {
  try {
    const items = await loadItems();
    const item = items.find((x) => x.id === itemId);
    if (!item) return { ok: false, error: "Item not found" };
    if (item.type !== "image") return { ok: false, error: "Only PNG supported" };

    const bytes = await fs.readFile(item.value);
    const pngBase64 = Buffer.from(bytes).toString("base64");

    return { ok: true, data: { pngBase64 } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Thumbnail failed" };
  }
}