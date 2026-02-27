## Problem Analysis (বাংলা): `constants.ts` + `types.ts` কেন “foundation”?

এই দুইটা ফাইল হলো তোমার প্রজেক্টের **foundation layer**:

* `constants.ts` → **fixed rules / specs** (page size, grid size, storage paths)
* `types.ts` → **data shape contract** (RegistryItem, PdfSettings, PreviewSettings)

তুমি যদি এগুলোকে ঠিকভাবে বুঝতে পারো, তাহলে বাকি সব ফাইল (actions/storage/pdf/preview/components) বুঝা অনেক সহজ হয়ে যায়—কারণ সবাই এগুলোর উপর দাঁড়িয়ে আছে।

---

## Architecture (বাংলা): এগুলো পুরো সিস্টেমে কীভাবে ব্যবহার হয়?

### `pageSpec`, `gridSpec`

* `pdf.ts` → mm→pt করে PDF layout বানায়
* `preview.ts` → mm→px করে preview image বানায়
* `LabelsApp` → UI subtitle এ page/grid info দেখায়

### `storageSpec`

* `storage.ts` → folder/file path এ read/write করে
* `actions.ts` → ensureDir/loadItems/saveItems call করে indirectly storageSpec ব্যবহার করছে

### Types (`RegistryItem`, `PdfSettings`…)

* client components → props/state safe রাখে
* server actions → payload safe রাখে
* pdf/preview logic → settings field safe access করে

---

# Code (TypeScript): A→Z (Beginner friendly)

# 1) `constants.ts`

## A) `pageSpec`

```ts
export const pageSpec = {
  pageWMm: 95.0,
  pageHMm: 150.0,
} as const;
```

### এটা কী?

PDF label sheet এর **page size** (mm)।

* Width = 95mm
* Height = 150mm

✅ কেন mm unit?
প্রিন্টিং/লেবেল ডিজাইনে mm বেশি reliable।
Browser px বা PDF pt—সবই শেষে mm এর সাথে convert হয়।

✅ `as const` কেন?
এটা TypeScript কে বলে:

* এই object-এর values “constant literal”
* accidental change করা বা type widen হওয়া থেকে বাঁচায়

উদাহরণ:

* `pageSpec.pageWMm` কে TS `number` না ধরে “95” literalও ধরতে পারে (useful for strictness).

---

## B) `gridSpec`

```ts
export const gridSpec = {
  cols: 9,
  rows: 3,
  colWMm: 10.0,
  rowHMm: 50.0,
} as const;
```

### এটা কী?

এক পেজে **grid layout**:

* 9 columns
* 3 rows
* প্রতিটা cell:

  * width = 10mm
  * height = 50mm

✅ এই gridSpec এক জায়গায় রাখায় লাভ:

* PDF এবং Preview দুই জায়গায় একই grid ব্যবহার হবে
* mismatch কমে যায় (এটাই তোমার comment এর মূল point)

---

## C) `storageSpec`

```ts
export const storageSpec = {
  itemsDir: "data/items",
  registryFile: "data/items_registry.json",
} as const;
```

### এটা কী?

লোকাল স্টোরেজ path rules:

* PNG files যাবে: `data/items/`
* registry list যাবে: `data/items_registry.json`

✅ এক জায়গায় রাখলে maintain সহজ:
আগামীতে যদি তুমি Supabase storage বা অন্য path ব্যবহার করো, শুধু এখানে change করলেই অনেক জায়গা fix হবে।

---

# 2) `types.ts`

## A) `ItemType`

```ts
export type ItemType = "image";
```

এটা এখন শুধু `"image"` allow করছে।

✅ কেন type বানালে?
future-proofing:

* পরে `"text" | "qr" | "barcode"` add করতে পারবে
* তখন TS ধরিয়ে দেবে কোথায় কোথায় update দরকার

---

## B) `RegistryItem`

```ts
export interface RegistryItem {
  id: string;
  name: string;
  type: ItemType;
  value: string;
}
```

### এটা কী?

Registry JSON file-এর **প্রতিটা row/record** এর shape।

* `id` → unique identifier (selection, deletion)
* `name` → UI তে দেখানো নাম
* `type` → এখন শুধু `"image"`
* `value` → actual file path (`data/items/xxx.png`)

✅ কেন value কে path রাখা?
কারণ local storage ব্যবহার করা হচ্ছে।
Production হলে value হতে পারে:

* storage URL (S3 link)
* Supabase storage path
* etc.

---

## C) `ImageFitMode`

```ts
export type ImageFitMode = "contain" | "cover";
```

Preview/PDF rendering এ image বসানোর rule:

* contain → পুরো image দেখা যাবে, empty space থাকতে পারে
* cover → box পুরো fill হবে, crop হতে পারে

---

## D) `PdfSettings`

```ts
export interface PdfSettings {
  pages: number;

  leftMarginMm: number;
  topMarginMm: number;
  colGapMm: number;
  rowGapMm: number;

  repeatPerCell: number;

  imageScale: number;
  imgPadMm: number;
  imageFitMode: ImageFitMode;

  drawCellBoxes: boolean;
  strokeWidthPt: number;

  drawInnerImageBox: boolean;
  innerBoxStrokePt: number;

  drawCutGuideLine: boolean;
  cutLineStrokePt: number;
}
```

### এটাকে বুঝার সহজ উপায়: ৫টা গ্রুপ

#### 1) Pages

* `pages` → কয় পেজ generate হবে

#### 2) Grid positioning (mm)

* margins + gaps
* এগুলো PDF/preview-এ grid শুরু ও spacing ঠিক করে

#### 3) Repeat logic

* `repeatPerCell` → প্রতি cell এ কয়বার image বসবে

#### 4) Image appearance

* `imageScale` → size ratio
* `imgPadMm` → inner padding
* `imageFitMode` → contain/cover rule

#### 5) Debug/print guides

* cell border
* inner image box
* cut guide line
* stroke thickness (pt)

✅ কেন thickness pt এ?
PDF drawing libs সাধারণত stroke thickness pt এ নেয়।
Preview.ts pt→px করে approximate করে।

---

## E) `PreviewSettings`

```ts
export interface PreviewSettings {
  showPreview: boolean;
  previewDpi: number;
  fullPage: boolean;
}
```

* `showPreview` → preview enable/disable
* `previewDpi` → quality vs speed tradeoff
* `fullPage` → full page render (slow) vs cropped grid render (fast)

---

## Critical Considerations (বাংলা): এগুলো নিয়ে ৪টা গুরুত্বপূর্ণ শেখার পয়েন্ট

1. **Constants এক জায়গায় রাখলে** PDF + preview mismatch কমে
2. **Types হলো contract**—UI ↔ server ↔ core logic সবাই একই shape follow করে
3. **Union types** (`"contain" | "cover"`) beginner-friendly safety দেয়
4. **Units discipline**: mm (layout), pt (pdf strokes), dpi/px (preview)

---

## Tiny improvement idea (optional, কিন্তু useful)

`PdfSettings` এ `leftMarginMm/topMarginMm/gaps` এর min/max validation এখন UI তে আছে।
Production mindset: server side (Zod) এও validate করলে ভালো—কেউ API call করে invalid value পাঠাতে পারবে না।

---

এখন তোমার প্রজেক্টের core algorithm অংশ একটাই বাকি:
✅ `lib/pdf.ts`

ওটা দিলে আমি:

* mm→pt conversion
* fixed grid
* repeat-per-cell layout
* image draw + borders + cut lines
  সবকিছু beginner-friendly করে explain করব, এবং preview.ts এর সাথে মিলিয়ে দেখাব কোথায় কোথায় mismatch হতে পারে।
