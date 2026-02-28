## Problem Analysis (বাংলা): এই ফাইলটা কী করছে, কেন দরকার?

`ItemsPanel.client.tsx` হলো তোমার অ্যাপের **Items tab / Items panel**—যেখানে ইউজার:

* PNG ফাইল **upload** করে
* নাম **auto-fill** (ফাইল নাম থেকে) বা manual নাম লিখে
* **Save** চাপলে PNG → **base64** করে server action-এ পাঠায় (via `props.onUpload`)
* registry থেকে আসা item list-এ **search** করে
* একটি item **select** করে
* selected item **delete** করে (via `props.onDeleteSelected`)

এটা পুরোপুরি **client component**, কারণ:

* file input, FileReader, onChange events—সব browser-এ চলে।

---

## Architecture (বাংলা): Data flow (UI → callbacks → server actions)

এই component নিজে server-এ কিছু করে না। বরং “controller” (সম্ভবত `LabelsApp.client.tsx`) থেকে props হিসেবে **ফাংশন** পায়:

* `onUpload(name, fileBase64)` → Server Action কল হয় (পেছনে)
* `onDeleteSelected()` → selected item delete server action
* `items`, `query`, `selectedId`, `busy` → সব parent state থেকে আসে

**Flow:**

1. User selects file → `handleFileChange()` → `file` state set + `name` auto set
2. User clicks Save → `handleSave()` → `fileToBase64()` → `props.onUpload()`
3. Save done → local reset (name/file/input clear)
4. Search input → `props.onQueryChange()` → parent filtered items পাঠায়
5. Select dropdown → `props.onSelect(id)` → parent selectedId update করে
6. Delete → `props.onDeleteSelected()` → server-side delete + UI refresh

---

## Code (TypeScript): A→Z লজিক ব্যাখ্যা (CSS বাদ)

### 1) `"use client";`

এটা Next.js App Router-এ বলে দেয়:
✅ এই ফাইলটা browser-এ run হবে (client-side)
কারণ এখানে `useState`, `useRef`, file input, FileReader আছে।

---

### 2) Imports

```ts
import React, { useRef, useState } from "react";
import type { RegistryItem } from "@/lib/types";
```

* `useState` → component-এর local state রাখতে
* `useRef` → DOM element (file input) কে ধরতে
* `RegistryItem` টাইপ → items array-এর shape নিশ্চিত করতে (TypeScript safety)

---

### 3) `fileToBase64(file)`

```ts
async function fileToBase64(file: File): Promise<string> { ... }
```

**কাজ:** Browser এ `File` object কে base64 Data URL string বানায়।
যেমন output হতে পারে:

```
data:image/png;base64,iVBORw0KGgoAAA...
```

**কেন Promise/async?**
FileReader asynchronous—ফাইল পড়তে সময় লাগে, তাই callback-based API কে Promise wrapper করা হয়েছে।

ভিতরের ধাপ:

* `new FileReader()`
* `reader.readAsDataURL(file)` → PNG কে Data URL বানায়
* `reader.onload` → সফল হলে `resolve(...)`
* `reader.onerror` → ব্যর্থ হলে `reject(...)`

> ছোট note: এখানে `String(reader.result ?? "")` দেওয়া—মানে result null হলেও safe string।

---

### 4) `safeNameFromFileName(fileName)`

এই ফাংশন **ফাইলের নাম থেকে clean item name বানায়**।

ধাপগুলো:

#### a) Extension remove

```ts
const withoutExt = fileName.replace(/\.[^/.]+$/, "");
```

* `"my-logo.png"` → `"my-logo"`
* regex মানে: শেষের `.something` অংশ কেটে ফেলো

#### b) Special characters remove

```ts
const replaced = withoutExt.replace(/[^a-zA-Z0-9\s\-]+/g, " ");
```

Allowed:

* letters, numbers
* whitespace `\s`
* hyphen `-`

বাকি সব → space

#### c) Multiple spaces collapse

```ts
const collapsed = replaced.replace(/\s+/g, " ");
```

`"my   logo"` → `"my logo"`

#### d) Trim edges

```ts
const finalName = collapsed.trim();
```

#### e) Length limit + fallback

```ts
return finalName.slice(0, 60) || "Item";
```

* নাম সর্বোচ্চ 60 chars
* সব কেটে গিয়ে empty হলে `"Item"`

---

### 5) Component Props (সবচেয়ে গুরুত্বপূর্ণ part)

```ts
export default function ItemsPanel(props: Readonly<{ ... }>)
```

এখানে `props` এর shape:

* `items: RegistryItem[]` → filtered list (search-এর পরে)
* `allItemsCount: number` → total items (search ছাড়াই)
* `query: string` → search box value
* `onQueryChange(v)` → query update callback
* `selectedId: string | null` → কোন item select করা
* `onSelect(id)` → selection change callback
* `onUpload(name, base64)` → upload handler (server action wrapper)
* `onDeleteSelected()` → delete handler
* `busy: boolean` → server কাজ করছে কি না (UI disable করার জন্য)

✅ `Readonly` মানে parent থেকে আসা props accidentally mutate করা যাবে না।

---

### 6) Local State (component-এর নিজের data)

```ts
const [name, setName] = useState<string>("");
const [file, setFile] = useState<File | null>(null);
const fileRef = useRef<HTMLInputElement | null>(null);
```

* `name` → input box-এ যা আছে
* `file` → user যে PNG select করেছে
* `fileRef` → file input DOM element

  * **কেন দরকার?** Save করার পর file input blank করতে: `fileRef.current.value = ""`

React-এ file input কে controlled (value দিয়ে) করা যায় না সহজে, তাই ref ব্যবহার করা হয়।

---

### 7) `handleFileChange(f)`

```ts
function handleFileChange(f: File | null): void
```

**কখন কল হয়?** user file select করলে।

এটা করে:

1. `setFile(f)` → file state update
2. যদি `f` নেই → return
3. যদি `name` input আগে খালি থাকে → auto fill name

এই অংশটা key:

```ts
setName((prev) => {
  if (prev.trim().length > 0) return prev;
  return safeNameFromFileName(f.name);
});
```

✅ কেন callback form `setName(prev => ...)`?
কারণ state update async, prev value reliable ভাবে পেতে callback safest.

---

### 8) `handleSave()`

```ts
async function handleSave(): Promise<void>
```

**কাজ:** validation → base64 → upload callback → reset

ধাপ:

1. `const n = name.trim();`
2. guard:

```ts
if (!n || !file) return;
```

3. file → base64:

```ts
const base64 = await fileToBase64(file);
```

4. parent handler call:

```ts
await props.onUpload(n, base64);
```

> এখানে parent side-এ server action call হবে।

5. reset UI:

```ts
setName("");
setFile(null);
if (fileRef.current) fileRef.current.value = "";
```

✅ Reset এর মানে:

* user আবার নতুন item upload করতে ready

---

### 9) Render section (JSX) — CSS বাদে “কি দেখাচ্ছে”

UI অংশে মূল functional points:

#### a) Name input (controlled input)

```tsx
<input
  value={name}
  onChange={(e) => setName(e.target.value)}
/>
```

এটা controlled input:

* value state থেকে
* onChange state update করে

#### b) File input

```tsx
<input
  ref={fileRef}
  type="file"
  accept="image/png"
  onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
/>
```

* `accept="image/png"` → file picker only png
* `e.target.files?.[0]` → first file
* না থাকলে null

#### c) Save button enable/disable logic

```tsx
disabled={props.busy || !name.trim() || !file}
onClick={() => void handleSave()}
```

* busy থাকলে disable
* name empty হলে disable
* file না থাকলে disable

`void handleSave()` → lint/TS warning এড়ানোর জন্য (promise return ignore করা হচ্ছে intentionally)

#### d) Search input

```tsx
value={props.query}
onChange={(e) => props.onQueryChange(e.target.value)}
```

এখানে state local না—parent handle করছে।

#### e) Conditional rendering (items list empty হলে message)

```tsx
{props.items.length === 0 ? (...) : (...)}
```

#### f) Select dropdown

```tsx
<select
  value={props.selectedId ?? ""}
  onChange={(e) => props.onSelect(e.target.value)}
>
  {props.items.map((it) => (
    <option key={it.id} value={it.id}>
      {it.name} (png)
    </option>
  ))}
</select>
```

* `key={it.id}` → React list rendering rule
* `value` controlled by parent selectedId
* change হলে parent update করে

#### g) Delete button

```tsx
disabled={props.busy || !props.selectedId}
onClick={() => void props.onDeleteSelected()}
```

selected না থাকলে delete করা যাবে না।

---

## Critical Considerations (বাংলা): এখানে শেখার ৭টা গুরুত্বপূর্ণ জিনিস

1. **Client component**: file reading only browser-এ সম্ভব
2. **FileReader + Promise**: callback API কে clean async/await বানিয়েছে
3. **Controlled input**: name/search input state দিয়ে control হচ্ছে
4. **Ref usage**: file input reset করার standard pattern
5. **Guard clauses**: save করার আগে empty নাম/ফাইল prevent
6. **Parent callbacks**: এই component “UI only”; business logic parent/server side
7. **busy flag**: UX + double-submit prevent (একই action বারবার চলে যাওয়া আটকায়)

---


এই পুরো কোডটি (ItemsPanel.client.tsx) একটি **Next.js Client Component**।  
আমি তোমাকে **খুব বিস্তারিতভাবে** বাংলায় ব্যাখ্যা করবো — প্রথমে সামগ্রিক কাজ, তারপর প্রত্যেক অংশ লাইন বাই লাইন, এবং শেষে **TypeScript-এর মৌলিক কনসেপ্টগুলো** যেগুলো এই কোডে ব্যবহার করা হয়েছে।

---

### 🎯 সামগ্রিক কাজ কী?
এই কম্পোনেন্টের নাম **ItemsPanel**।  
এটি একটা **PNG আইটেম ম্যানেজমেন্ট প্যানেল**।  
ব্যবহারকারী এখান থেকে করতে পারবে:
- নতুন PNG ছবি আপলোড করে নাম দিয়ে সেভ করা
- আগে থেকে আপলোড করা সব আইটেম দেখা ও সার্চ করা
- কোনো একটা আইটেম সিলেক্ট করে ডিলিট করা

এটি Next.js-এর **"use client"** মার্ক করা আছে, অর্থাৎ এটা ব্রাউজারে চলবে (ক্লায়েন্ট সাইড)।

---

### ১. Helper Functions (সাহায্যকারী ফাংশন)

#### `fileToBase64(file: File): Promise<string>`
(আগের বার আমি এটার বিস্তারিত ব্যাখ্যা দিয়েছি। সংক্ষেপে:)
- ফাইলকে Base64 স্ট্রিং-এ কনভার্ট করে।
- `FileReader` ব্যবহার করে `readAsDataURL` করে।
- `Promise` দিয়ে async করে রাখা হয়েছে যাতে `await` করা যায়।

#### `safeNameFromFileName(fileName: string): string`
এটা খুব সুন্দর একটা ফাংশন। কাজ:
- ফাইলের নাম থেকে `.png` এক্সটেনশন সরায়
- স্পেশাল ক্যারেক্টার (যেমন @#$%) কে স্পেসে পরিবর্তন করে
- একাধিক স্পেসকে একটা স্পেসে কমায়
- শুরু/শেষের স্পেস সরায়
- সর্বোচ্চ ৬০ অক্ষর রাখে
- যদি কিছু না থাকে তাহলে "Item" রাখে

**উদাহরণ:**
- "My Cool Photo @2025!.png" → "My Cool Photo 2025"

---

### ২. Props (প্যারামিটার) — TypeScript এর সবচেয়ে গুরুত্বপূর্ণ অংশ

```ts
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
```

**Readonly<{}>** → প্রপস অবজেক্টকে immutable (পরিবর্তন করা যাবে না) করে দেয়।  
এখানে যা যা আসবে তার টাইপ:

| প্রপসের নাম          | টাইপ                              | মানে |
|---------------------|-----------------------------------|------|
| `items`             | `RegistryItem[]`                  | সব আইটেমের লিস্ট |
| `allItemsCount`     | `number`                          | মোট কতটা আইটেম আছে |
| `query`             | `string`                          | সার্চ বক্সের টেক্সট |
| `onQueryChange`     | `(v: string) => void`             | সার্চ টেক্সট চেঞ্জ হলে কল হবে |
| `selectedId`        | `string | null`                   | কোন আইটেম সিলেক্ট করা আছে |
| `onSelect`          | `(id: string) => void`            | সিলেক্ট করলে কল হবে |
| `onUpload`          | `(name, base64) => Promise<void>` | আপলোডের জন্য প্যারেন্ট কম্পোনেন্টে কল |
| `onDeleteSelected`  | `() => Promise<void>`             | ডিলিটের জন্য |
| `busy`              | `boolean`                         | লোডিং চলছে কি না |

---

### ৩. State ও Ref (React Hooks)

```ts
const [name, setName] = useState<string>("");
const [file, setFile] = useState<File | null>(null);
const fileRef = useRef<HTMLInputElement | null>(null);
```

- `useState<string>("")` → নামের জন্য স্টেট (শুরুতে খালি স্ট্রিং)
- `useState<File | null>(null)` → আপলোড করা ফাইল স্টোর করা
- `useRef<HTMLInputElement | null>` → ফাইল ইনপুটের রেফারেন্স (reset করার জন্য)

---

### ৪. Event Handlers

#### `handleFileChange(f: File | null)`
- ফাইল সিলেক্ট হলে `setFile` করে
- যদি নাম খালি থাকে তাহলে `safeNameFromFileName` দিয়ে অটো নাম ভরে দেয়

#### `handleSave()` (async)
1. নাম এবং ফাইল আছে কি না চেক করে
2. `fileToBase64` দিয়ে Base64 বানায়
3. `props.onUpload(n, base64)` কল করে প্যারেন্টে পাঠায়
4. সব রিসেট করে (নাম, ফাইল, ইনপুট)

---

### ৫. JSX (UI অংশ)

- দুইটা ইনপুট: নাম + ফাইল আপলোড
- Save বাটন (disabled যদি নাম/ফাইল না থাকে বা busy থাকে)
- সার্চ ইনপুট
- সিলেক্ট ড্রপডাউন (সব আইটেম দেখায়)
- Delete বাটন

---

### TypeScript Basics যা এই কোডে ব্যবহার করা হয়েছে (খুব সহজ ভাষায়)

| TS কনসেপ্ট               | কোডে কোথায় আছে                          | ব্যাখ্যা |
|-------------------------|------------------------------------------|--------|
| **Type Annotation**     | `file: File`, `Promise<string>`          | ভ্যারিয়েবলের টাইপ বলে দেওয়া |
| **Interface / Type**    | `RegistryItem[]`, `Readonly<{}>`         | অবজেক্টের শেপ নির্ধারণ |
| **Union Type**          | `string | null`                          | দুইটা টাইপ হতে পারে |
| **Generic**             | `useState<string>`, `useRef<HTMLInputElement>` | টাইপ প্যারামিটার |
| **Function Type**       | `onQueryChange: (v: string) => void`     | ফাংশনের সিগনেচার |
| **Async / Await**       | `handleSave()` এবং `fileToBase64`        | প্রমিস হ্যান্ডেলিং |
| **Readonly**            | `props: Readonly<{}>`                    | প্রপস পরিবর্তন করা যাবে না |
| **Optional Chaining**   | `e.target.files?.[0]`                    | যদি null হয় তাহলে error না দিয়ে undefined |
| **Nullish Coalescing**  | `reader.result ?? ""`                    | null/undefined হলে ডিফল্ট ভ্যালু |

---

### কেন এই কোডটা এত ভালো লেখা?

- **Type Safety**: কোনো ভুল ডাটা আসলে কম্পাইল টাইমেই ধরা পড়বে
- **Reusability**: সব লজিক আলাদা ফাংশনে
- **User Experience**: অটো নাম ফিল, ফাইল রিসেট, লোডিং স্টেট
- **Clean Code**: প্রত্যেক ফাংশনের উপরে ✅ কমেন্ট আছে কেন লেখা হয়েছে

---
