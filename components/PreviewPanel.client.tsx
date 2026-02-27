// labels-next/components/PreviewPanel.client.tsx
"use client";

import React from "react";

export default function PreviewPanel(props: Readonly<{ jpgUrl: string | null }>) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">JPG Preview — First page</h3>
        <span className="badge">JPEG</span>
      </div>

      {!props.jpgUrl ? (
        <p className="mt-2 help">Preview render করলে এখানে দেখাবে।</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <img className="w-full" src={props.jpgUrl} alt="Preview" />
        </div>
      )}
    </div>
  );
}