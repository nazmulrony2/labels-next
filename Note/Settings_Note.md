## Problem Analysis (বাংলা): SettingsPanel আসলে কী?

`SettingsPanel.client.tsx` হলো তোমার অ্যাপের **“sidebar control panel”** (Streamlit-এর sidebar এর মতো)।
এটা কোনো PDF বানায় না, কোনো preview render করে না—এটা শুধু:

* user input নেয় (pages, margin, gap, scale, border, dpi etc.)
* সেই values গুলো parent (`LabelsApp`) কে পাঠায়
* parent সেই settings দিয়ে server action call করে PDF/Preview তৈরি করে

তাই এটাকে ভাবো: **Remote Control**
আর `LabelsApp` হলো **TV** (আসল কাজটা করে)।

---

## Architecture (বাংলা): Controlled Settings Pattern (React-এর core concept)

এই component-এ **state নেই** (except helper parsing function)।
সব settings আসে props দিয়ে:

* `pdfSettings` (s)
* `previewSettings` (p)

আর update করে parent-কে callback দিয়ে:

* `onPdfSettingsChange(next)`
* `onPreviewSettingsChange(next)`

✅ এটাকে বলে **controlled component** pattern:

* Value কোথায় থাকে? → Parent state (LabelsApp)
* UI কী করে? → user input দেখায় + parent-কে update request দেয়

---

# Code (TypeScript): A→Z (CSS বাদ দিয়ে লজিক বুঝি)

## 1) `toNumber(v, fallback)`

```ts
function toNumber(v: string, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
```

### কেন এটা দরকার?

React input থেকে সবসময় `e.target.value` **string** আসে—even `type="number"` হলেও!
তাই তোমাকে string → number convert করতে হয়।

### fallback কেন?

যদি user input ফাঁকা করে দেয় বা invalid হয়:

* `Number("")` → 0 হতে পারে
* `Number("abc")` → NaN
  তখন তোমার settings NaN হয়ে গেলে PDF/preview logic ভেঙে যেতে পারে।

✅ তাই invalid হলে আগের value বা default fallback রেখে দাও।

---

## 2) Props এবং s/p alias

```ts
const s = props.pdfSettings;
const p = props.previewSettings;
```

কেন alias?
বারবার `props.pdfSettings.pages` লিখতে হয় না।
`s.pages` লেখা সহজ।

---

## 3) “Immutable update” pattern: `{ ...s, field: newValue }`

তুমি প্রায় সব জায়গায় এই pattern ব্যবহার করেছ:

```ts
props.onPdfSettingsChange({ ...s, pages: toNumber(e.target.value, 1) })
```

### কেন spread (`...s`) দিয়ে copy?

React state **directly mutate** করা যাবে না।

❌ ভুল:

```ts
s.pages = 5;
props.onPdfSettingsChange(s);
```

✅ ঠিক:

```ts
props.onPdfSettingsChange({ ...s, pages: 5 });
```

কারণ:

* নতুন object তৈরি হয়
* React বুঝতে পারে “state changed” → rerender হয়

---

# PDF Section (settings কীভাবে কাজ করে)

## A) Pages

```tsx
<input
  type="number"
  min={1}
  max={500}
  value={s.pages}
  onChange={(e) => props.onPdfSettingsChange({ ...s, pages: toNumber(e.target.value, 1) })}
/>
```

* `value={s.pages}` → controlled input
* `onChange` → নতুন pages parent-এ পাঠায়
* `min/max` → browser-level validation hint (logic level guard না, তবে helpful)

---

## B) Margins (left/top)

দুইটা input দিয়ে একই কাজ:

* leftMarginMm update
* topMarginMm update

Pattern একই:

* parse number
* `{ ...s, leftMarginMm: parsed }`

✅ “Mm” unit important কারণ PDF layout algorithm mm → pt conversion করে (server-side)।

---

## C) Column/Row gap

`colGapMm` / `rowGapMm` grid spacing control করে।

* gap বাড়ালে cell গুলো আলাদা হবে
* gap 0 হলে tight grid

---

## D) repeatPerCell

একটা cell-এর ভেতর vertical repeats কয়বার হবে—এটা pdf.ts/preview.ts-এর algorithm এ apply হয়।

---

# PNG Section (image rendering controls)

## A) imageScale (range slider)

```tsx
<input
  type="range"
  min={0.2}
  max={1.2}
  step={0.05}
  value={s.imageScale}
  onChange={(e) => props.onPdfSettingsChange({ ...s, imageScale: toNumber(e.target.value, s.imageScale) })}
/>
```

### এটা কী?

cell-এর ভিতরে PNG কত বড়/ছোট হবে।

* 1.0 মানে full size (logic অনুযায়ী)
* 0.5 মানে half
* 1.2 মানে slightly larger

✅ slider ব্যবহার করা UX-friendly।

---

## B) imgPadMm

Image-এর চারপাশে padding (mm)
এটা layout algorithm এ “inner area” বানাতে সাহায্য করে যাতে image border touch না করে।

---

## C) imageFitMode (contain/cover)

```tsx
onChange={(e) =>
  props.onPdfSettingsChange({
    ...s,
    imageFitMode: e.target.value === "cover" ? "cover" : "contain",
  })
}
```

TypeScript-safe guard:

* value যদি "cover" হয় → cover
* otherwise contain

### contain vs cover (simple idea)

* **contain**: পুরো image দেখা যাবে, কিন্তু ফাঁকা জায়গা থাকতে পারে
* **cover**: area পুরো ভরবে, কিন্তু image crop হতে পারে

---

# Borders Section (debug/printing aids)

## drawCellBoxes (checkbox)

```tsx
checked={s.drawCellBoxes}
onChange={(e) => props.onPdfSettingsChange({ ...s, drawCellBoxes: e.target.checked })}
```

Checkbox-এ `value` না, `checked` ব্যবহার হয়।

## strokeWidthPt

border thickness points এ (pt)
PDF drawing library সাধারণত pt unit এ stroke নেয়—তাই settings pt রাখা logical।

## drawInnerImageBox

debug purposes—image এর “calculated box” দেখতে।

## innerBoxStrokePt

inner box thickness

## drawCutGuideLine

repeat এর প্রতিটা Y পয়েন্টে cut guide line আঁকবে।

## cutLineStrokePt

cut guide thickness

---

# Preview Section (Preview engine controls)

## showPreview

Enable/disable preview rendering

`LabelsApp.handleRenderPreview()` এ তুমি দেখেছ:

* preview disabled হলে toast info দেয়

## previewDpi

DPI বাড়ালে preview বেশি sharp হবে, কিন্তু render slow হবে + memory বেশি লাগবে

## fullPage

* off থাকলে শুধু grid region / quick preview
* on থাকলে full page render (slower)

---

## Critical Considerations (বাংলা): এখানে শেখার সবচেয়ে গুরুত্বপূর্ণ ৮টা জিনিস

1. `type="number"` হলেও `e.target.value` string
2. `toNumber()` না করলে NaN bugs হবে
3. `{...s, field: x}` = immutable update → React rerender trigger
4. Checkbox এ `checked` ব্যবহার করতে হয়
5. Controlled form মানে value parent state থেকে আসে
6. SettingsPanel হলো “dumb UI” — logic parent/server এ
7. Units consistent রাখা জরুরি (mm vs pt vs dpi)
8. Browser min/max validation reliable guard না—server-side validate করাও ভালো (actions/pdf)

---

## ছোট কিন্তু “Better way” suggestion (তোমার শেখা সহজ করতে)

এখন অনেক জায়গায় repeated code আছে:

```ts
onChange={(e) => props.onPdfSettingsChange({ ...s, X: toNumber(e.target.value, s.X) })}
```

এটা future-এ helper দিয়ে DRY করা যায়, কিন্তু learning stage-এ current style clear ও readable।

---

পরেরটা দিলে তোমার পুরো app “complete mental model” তৈরি হবে:
✅ `lib/actions.ts`
কারণ এখানেই বোঝা যাবে: SettingsPanel-এর values server action এ কীভাবে যাচ্ছে এবং server কী return করছে।
