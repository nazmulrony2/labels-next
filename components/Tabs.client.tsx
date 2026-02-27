// labels-next/components/Tabs.client.tsx

"use client";

import React from "react";

export type TabKey = "items" | "generate" | "preview";

export default function Tabs(props: Readonly<{
  value: TabKey;
  onChange: (v: TabKey) => void;
}>) {
  const btn = (key: TabKey, label: string) => {
    const active = props.value === key;
    return (
      <button
        className={`btn ${active ? "btn-primary" : ""}`}
        onClick={() => props.onChange(key)}
        type="button"
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {btn("items", "📦 Items")}
      {btn("generate", "🧾 Generate")}
      {btn("preview", "🖼️ Preview")}
    </div>
  );
}