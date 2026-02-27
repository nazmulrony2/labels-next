## Problem Analysis (বাংলা): `actions.ts` কেন সবচেয়ে গুরুত্বপূর্ণ?

এই ফাইলটাই তোমার অ্যাপের **Backend Gateway** (Server Actions layer)।
Client components (ItemsPanel/LabelsApp) সরাসরি filesystem বা pdf renderer touch করে না—তারা শুধু এই action গুলো call করে।

এখানে মূল দায়িত্ব ৫টা:

1. ✅ Input validation (Zod)
2. ✅ File save/delete + registry update (`storage.ts`)
3. ✅ PDF bytes generate (`pdf.ts`)
4. ✅ Preview JPG bytes generate (`preview.ts`)
5. ✅ Binary data কে base64 বানিয়ে client এ পাঠানো (কারণ browser এ bytes পাঠানো/preview করা সহজ না)

এটাকে ভাবো:
**UI → Server Action → Core Logic → Response**

---

## Architecture (বাংলা): Data flow (প্রতিটা action কীভাবে কাজ করে)

* `LabelsApp` / `ItemsPanel` → `savePngItemAction(...)` call
* server-side:

  * validate করে
  * base64 decode করে bytes বানায়
  * png file save করে
  * registry JSON update করে
  * `revalidatePath("/")` দিয়ে page refresh trigger করে
* response: `{ ok, data, error }`

এটা একইভাবে delete/pdf/preview/thumb—সব জায়গায় consistent।

---

# Code (TypeScript): A→Z ব্যাখ্যা (লজিক/টেকনিকাল ফোকাস)

## 0) `"use server"`

```ts
"use server";
```

এটা Next.js-কে বলে দেয়:
✅ এই ফাইলে export করা function গুলো **Server Actions** (server-side only)

এর মানে:

* এখানে `fs`, `crypto`, `Buffer` ব্যবহার করা safe
* এগুলো browser bundle এ যাবে না

---

## 1) Imports: কেন এগুলো দরকার

```ts
import crypto from "crypto";
import fs from "fs/promises";
import { z } from "zod";
import { revalidatePath } from "next/cache";
```

* `crypto.randomUUID()` → unique id বানাতে
* `fs.readFile` → png thumbnail read করতে
* `zod` → input validation (bad input early reject)
* `revalidatePath("/")` → server component page cache refresh/invalidates

আর core imports:

```ts
import { ensureDir, loadItems, saveItems, savePngFile, deleteFileIfExists } from "./storage";
import { generatePdfBytes } from "./pdf";
import { renderPreviewJpg } from "./preview";
```

এগুলোই “Core Logic” layer।

---

## 2) `ActionResult<T>`: consistent response contract

```ts
export interface ActionResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
```

### কেন এটা দরকার?

Client-side তোমার UI সবসময় এই structure expect করে:

* `ok === true` হলে `data` থাকবে (সাধারণত)
* `ok === false` হলে `error` message থাকবে

✅ এটা Streamlit-এর “st.success / st.error” এর Next.js version।

**Client example mental model:**

```ts
const res = await action(...)
if (!res.ok) showToast(res.error)
else use res.data
```

---

## 3) Zod schema: add item validation

```ts
const addItemSchema = z.object({
  name: z.string().trim().min(1, "...").max(80),
  fileBase64: z.string().min(1),
});
```

### কেন দরকার?

Client malicious/buggy হতে পারে:

* empty name পাঠাতে পারে
* base64 empty পাঠাতে পারে
* huge/invalid string পাঠাতে পারে

✅ server-side validate না করলে storage/pdf layer crash করবে।

Zod `parse()` করলে:

* valid হলে typed parsed value দেয়
* invalid হলে exception throw করে → catch এ গিয়ে `{ok:false, error}` return

---

# 4) `getItemsAction()` (registry read)

```ts
export async function getItemsAction(): Promise<ActionResult<RegistryItem[]>> {
  try {
    await ensureDir(storageSpec.itemsDir);
    const items = await loadItems();
    return { ok: true, data: items };
  } catch (e) {
    return { ok: false, error: ... };
  }
}
```

### লজিক:

1. storage folder ensure করে (না থাকলে বানায়)
2. registry json read করে
3. items array return

✅ এটা initial page render বা refresh এ কাজে লাগে।

---

# 5) `savePngItemAction()` (সবচেয়ে গুরুত্বপূর্ণ)

### Input

```ts
{name, fileBase64}
```

`fileBase64` দুইভাবে আসতে পারে:

1. DataURL: `"data:image/png;base64,AAAA..."`
2. Raw base64: `"AAAA..."`

তাই তুমি normalize করেছ:

```ts
const base64 = parsed.fileBase64.includes(",")
  ? parsed.fileBase64.split(",")[1]
  : parsed.fileBase64;
```

✅ কেন header কাটতে হয়?
`Buffer.from(..., "base64")` raw base64 চায়।
DataURL header থাকলে decode fail হতে পারে।

---

### Base64 → Bytes

```ts
const fileBytes = Buffer.from(base64, "base64");
if (fileBytes.length < 8) throw new Error("Invalid PNG data");
```

✅ কেন length check?
কমপক্ষে কিছু bytes না থাকলে নিশ্চিতভাবে invalid।
(Advanced: PNG signature check করা যায়—আমি নিচে বলছি)

---

### ID তৈরি

```ts
const id = crypto.randomUUID();
const idShort = id.slice(0, 8);
```

* `id` = registry key + UI select key
* `idShort` = filename friendly short id

---

### File save

```ts
const filePath = await savePngFile({
  fileBytes: new Uint8Array(fileBytes),
  name: parsed.name,
  idShort,
});
```

✅ কেন `Uint8Array`?
তোমার storage layer সম্ভবত web-style typed array নেয়। Buffer → Uint8Array convert safe।

`savePngFile` presumably:

* sanitize filename
* write file to `data/items/`
* return path string

---

### Registry item তৈরি

```ts
const newItem: RegistryItem = {
  id,
  name: parsed.name,
  type: "image",
  value: filePath,
};
```

✅ `value` = file path (local FS)
✅ `type` = future-proofing (later other types)

---

### Registry update

```ts
const items = await loadItems();
await saveItems([...items, newItem]);
```

✅ JSON file-এ append করে save করছে।

> Note: এখানে concurrency risk আছে (দুইজন একসাথে save করলে overwrite)। local demo ok; production এ DB/locking দরকার।

---

### revalidatePath("/")

```ts
revalidatePath("/");
```

✅ কেন?
Next.js server components cached থাকতে পারে।
নতুন item save হলে server-rendered `initialItems` (page.tsx) যেন refresh হয়ে correct items দেখায়—এই invalidation দরকার।

---

### Response

```ts
return { ok: true, data: newItem };
```

Client তখন items state update করে UI তে দেখায়।

---

# 6) `deleteItemAction(id)`

Flow:

1. items load
2. target find (না থাকলে error)
3. rest items save
4. file delete safe (missing হলেও ok)
5. revalidate
6. return ok

```ts
await deleteFileIfExists(target.value);
```

✅ কেন “safe delete”?
যদি file manually delete হয়ে যায়, registry delete process fail হওয়া উচিত না।

---

# 7) `generatePdfAction({itemId, settings})`

Flow:

1. items load
2. item find
3. `generatePdfBytes({ item, settings })`
4. bytes → base64
5. return `{pdfBase64}`

```ts
const pdfBase64 = Buffer.from(bytes).toString("base64");
```

✅ কেন base64?
Server bytes কে browser-side `Blob URL` বানিয়ে download/iframe preview করার জন্য।

---

# 8) `renderPreviewAction({ itemId, settings, dpi, fullPage })`

এটা PDF-এর মতোই, শুধু engine আলাদা:

* `renderPreviewJpg(...)` → jpg bytes
* bytes → base64 → client এ পাঠানো

✅ DPI/fullPage setting preview render algorithm-এ apply হয়।

---

# 9) `getItemPngBase64Action(itemId)` (thumbnail)

Flow:

1. items load
2. item find + type check
3. fs.readFile(item.value) → png bytes
4. bytes → base64
5. return `{ pngBase64 }`

Client-side:

* base64ToObjectUrl(..., "image/png") করে `<img src=...>`

---

## Critical Considerations (বাংলা): Security, Performance, Cost

### 1) Security

* ✅ Zod validation আছে—good
* ⚠️ `fileBase64` size limit নেই
  কেউ huge base64 পাঠালে server memory spike হতে পারে
  → Zod এ `.max(...)` যোগ করা উচিত (string length)
* ⚠️ PNG signature verify করা ভালো
  এখন শুধু length check আছে; malicious data decode হতে পারে

PNG signature check (idea):

* PNG প্রথম 8 bytes: `89 50 4E 47 0D 0A 1A 0A`
* match না করলে reject

### 2) Performance

* `loadItems()` + `saveItems()` প্রতি action এ disk IO
  items বড় হলে slow হবে
* preview/pdf bytes base64 conversion costly (ok for small)

### 3) Cost

Local FS demo cheap
Production এ Vercel/serverless হলে:

* local FS persistent না
* S3/Supabase storage + DB better

---

## “Explain more better way” — একদম সহজ ভাষায় summary

* `actions.ts` হলো server-side functions list
* প্রতিটা function:

  1. validate করে
  2. registry/file পড়া-লেখা করে
  3. core renderer call করে (pdf/preview)
  4. result কে base64 করে দেয়
  5. `{ok,data,error}` format এ ফেরত দেয়

---

পরের ফাইল দিলে পুরো rendering logic crystal clear হবে:
✅ `lib/storage.ts` (file + registry read/write কীভাবে হচ্ছে)
এরপর `lib/pdf.ts` (grid layout algorithm) এবং `lib/preview.ts` (canvas-style preview algorithm)।
