// labels-next/app/page.tsx

import LabelsApp from "@/components/LabelsApp.client";
import { getItemsAction } from "@/lib/actions";
import type { RegistryItem } from "@/lib/types";

export default async function Page() {
  // কেন: initial render এ server-side থেকে items load করলে first load fast হয়
  const res = await getItemsAction();
  const items: RegistryItem[] = res.ok && res.data ? res.data : [];

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="card p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Spinning Label Sticker Printer
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Upload PNG → Search → Preview → Multi-page PDF
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="badge">PNG only</span>
            <span className="badge">PDF export</span>
            <span className="badge">JPG preview</span>
          </div>
        </div>

        <div className="divider" />

        <LabelsApp initialItems={items} />
      </div>
    </main>
  );
}