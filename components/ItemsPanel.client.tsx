// labels-next/components/ItemsPanel.client.tsx
"use client";

import React, { useRef, useState } from "react";
import type { RegistryItem } from "@/lib/types";

/**
 * ✅ কেন: Browser side এ File → base64 convert করতে FileReader দরকার
 */
async function fileToBase64(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * ✅ কেন: file name clean করে human-readable name বানানো
 * - extension remove
 * - special character remove
 * - space preserve
 * - multiple space collapse
 */
function safeNameFromFileName(fileName: string): string {
  // remove extension (.png)
  const withoutExt = fileName.replace(/\.[^/.]+$/, "");

  // special characters → space
  const replaced = withoutExt.replace(/[^a-zA-Z0-9\s\-]+/g, " ");

  // collapse multiple spaces
  const collapsed = replaced.replace(/\s+/g, " ");

  // trim start/end space
  const finalName = collapsed.trim();

  return finalName.slice(0, 60) || "Item";
}

export default function ItemsPanel(props: Readonly<{
  items: RegistryItem[];
  allItemsCount: number;
  query: string;
  onQueryChange: (v: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpload: (name: string, fileBase64: string) => Promise<void>;
  onDeleteSelected: () => Promise<void>;
  busy: boolean;
}>) {
  const [name, setName] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  /**
   * ✅ কেন: file select হলে
   * - file state set
   * - name empty থাকলে auto-fill
   */
  function handleFileChange(f: File | null): void {
    setFile(f);

    if (!f) return;

    // যদি user আগে থেকে name লিখে না থাকে → auto fill
    setName((prev) => {
      if (prev.trim().length > 0) return prev;
      return safeNameFromFileName(f.name);
    });
  }

  async function handleSave(): Promise<void> {
    const n = name.trim();
    if (!n || !file) return;

    const base64 = await fileToBase64(file);
    await props.onUpload(n, base64);

    // reset
    setName("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="card-title">➕ Add PNG Item</h2>
        <p className="card-subtitle">
          PNG upload করলে file name থেকে auto name fill হবে।
        </p>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">Name</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Auto-filled from file name..."
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">Upload PNG</label>
        <input
          ref={fileRef}
          className="input"
          type="file"
          accept="image/png"
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
        />
        <p className="help">
          File name → auto name. চাইলে manually edit করতে পারবে।
        </p>
      </div>

      <button
        className="btn btn-primary"
        disabled={props.busy || !name.trim() || !file}
        onClick={() => void handleSave()}
      >
        ➕ Save PNG Item
      </button>

      <div className="divider" />

      <div>
        <h3 className="text-sm font-semibold">🔎 Search</h3>
        <p className="help">Total items: {props.allItemsCount}</p>
      </div>

      <input
        className="input"
        value={props.query}
        onChange={(e) => props.onQueryChange(e.target.value)}
        placeholder="Search by name..."
      />

      {props.items.length === 0 ? (
        <p className="text-sm text-slate-600">কোনো item পাওয়া যায়নি।</p>
      ) : (
        <div className="grid gap-2">
          <label className="text-sm font-medium">Select item</label>
          <select
            className="select"
            value={props.selectedId ?? ""}
            onChange={(e) => props.onSelect(e.target.value)}
          >
            {props.items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name} (png)
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        className="btn btn-danger"
        disabled={props.busy || !props.selectedId}
        onClick={() => void props.onDeleteSelected()}
      >
        🗑️ Delete selected item
      </button>
    </div>
  );
}