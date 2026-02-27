// labels-next/lib/storage.ts
import path from "path";
import fs from "fs/promises";
import { storageSpec } from "./constants";
import type { RegistryItem } from "./types";

// ✅ কেন: directory না থাকলে save ব্যর্থ হবে (Streamlit ensure_dir)
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

// ✅ কেন: unsafe character file name এ থাকলে OS issue হয়, তাই sanitize
export function safeFilename(name: string): string {
  const cleaned = name.trim().replace(/[^a-zA-Z0-9_\-]+/g, "_");
  return (cleaned.length > 0 ? cleaned : "item").slice(0, 60);
}

// ✅ কেন: registry file না থাকলে empty list return (crash avoid)
export async function loadItems(): Promise<RegistryItem[]> {
  try {
    const raw = await fs.readFile(storageSpec.registryFile, "utf-8");
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    // ✅ কেন: runtime guard—TS runtime এ enforce করে না
    const items: RegistryItem[] = [];
    for (const x of parsed) {
      if (
        typeof x === "object" &&
        x !== null &&
        "id" in x &&
        "name" in x &&
        "type" in x &&
        "value" in x
      ) {
        const rec = x as Record<string, unknown>;
        if (
          typeof rec.id === "string" &&
          typeof rec.name === "string" &&
          rec.type === "image" &&
          typeof rec.value === "string"
        ) {
          items.push({
            id: rec.id,
            name: rec.name,
            type: "image",
            value: rec.value,
          });
        }
      }
    }
    return items;
  } catch {
    return [];
  }
}

// ✅ কেন: persist করলে reload এর পরেও data থাকবে
export async function saveItems(items: RegistryItem[]): Promise<void> {
  await ensureDir(path.dirname(storageSpec.registryFile));
  await fs.writeFile(storageSpec.registryFile, JSON.stringify(items, null, 2), "utf-8");
}

// ✅ কেন: PNG file write helper
export async function savePngFile(params: {
  fileBytes: Uint8Array;
  name: string;
  idShort: string;
}): Promise<string> {
  await ensureDir(storageSpec.itemsDir);

  const base = `${safeFilename(params.name)}_${params.idShort}.png`;
  const filePath = path.join(storageSpec.itemsDir, base);

  await fs.writeFile(filePath, params.fileBytes);
  return filePath;
}

// ✅ কেন: file delete helper (না থাকলেও fail না করে ignore করলে UX ভালো)
export async function deleteFileIfExists(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore intentionally
  }
}