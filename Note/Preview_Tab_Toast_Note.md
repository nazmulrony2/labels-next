নাইস—এই ৩টা ফাইল ছোট হলেও এগুলোই UI/UX-কে “পলিশড অ্যাপ” বানায়। আমি **CSS/ক্লাস পার্ট বাদ** দিয়ে পুরো লজিকটা খুব সহজভাবে বুঝিয়ে দিচ্ছি।

---

## Problem Analysis (বাংলা): এই ৩টা ফাইলের কাজ কী?

তুমি `LabelsApp.client.tsx`-এ দেখেছ:

* `useToasts()` থেকে `{ toasts, push, dismiss }` আসে
* `ToastHost` সেই `toasts` দেখায়
* `PreviewPanel` JPG preview দেখায়
* `Tabs` tab switch করে (Items/Generate/Preview)

অর্থাৎ:

* **ToastHost + useToasts** = Notification system (success/error/info)
* **PreviewPanel** = “JPG দেখাও না থাকলে placeholder”
* **Tabs** = UI navigation control (controlled component)

---

## Architecture (বাংলা): Data flow (এক লাইনে)

* `LabelsApp` হলো parent → state রাখে
* `useToasts()` toast state manage করে
* `ToastHost` purely render করে
* `Tabs` purely render করে এবং `onChange` দিয়ে parent state বদলায়
* `PreviewPanel` purely render করে `jpgUrl` অনুযায়ী

এগুলো সবই **presentational + small logic** components।

---

# 1) ToastHost.client.tsx (Toast system)

## A) Types: ToastKind, ToastItem

```ts
export type ToastKind = "success" | "error" | "info";
export interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
}
```

✅ কেন দরকার?

* `kind` দিয়ে toast এর ধরন বোঝায়
* `id` দিয়ে uniqueভাবে dismiss করা যায়
* `message?` optional (কখনও শুধু title হতে পারে)

TypeScript এখানে তোমাকে protect করে:

* ভুল kind দিলে compile error
* `message` না দিলেও error হবে না কারণ optional

---

## B) ToastHost component (শুধু list render)

```tsx
export default function ToastHost(props: { toasts; onDismiss })
```

কাজ:

* `props.toasts` array loop করে
* প্রত্যেকটা toast → `<ToastCard />` এ পাঠায়
* `key={t.id}` React list rule

এটা “দোকানের শেলফ”-এর মতো:
**নিজে toast বানায় না, শুধু দেখায়।**

---

## C) ToastCard component (একটা toast দেখায় + dismiss button)

```tsx
function ToastCard(props: { toast; onDismiss })
```

### 1) “tone” selection (kind অনুযায়ী UI)

তুমি CSS ignore করতে বলেছ, তাই লজিকটা শুধু:

* success হলে success style
* error হলে error style
* info হলে normal style

### 2) Dismiss button

```tsx
<button onClick={() => props.onDismiss(toast.id)}>✕</button>
```

✅ কেন ID দরকার?

* কোন toast remove করবে সেটা identify করতে

---

## D) useToasts() hook (এটাই আসল “মগজ”)

এই hook-ই toast add/remove + auto-dismiss টাইমার manage করে।

### 1) State + timers

```ts
const [toasts, setToasts] = useState<ToastItem[]>([]);
const timers = useRef<Map<string, number>>(new Map());
```

✅ কেন `useRef(Map)`?

* `timers` হলো mutable storage যা re-render এ reset হবে না
* state করলে re-render trigger হতো; এখানে দরকার নেই
* প্রতিটা toast id → তার timeout id store করা

---

### 2) dismiss(id)

```ts
const dismiss = useCallback((id) => {
  setToasts(prev => prev.filter(t => t.id !== id));
  const tm = timers.current.get(id);
  if (tm) window.clearTimeout(tm);
  timers.current.delete(id);
}, []);
```

এটা ৩টা কাজ করে:

1. list থেকে toast remove
2. ওই toast-এর timer থাকলে clear
3. map থেকে entry delete

✅ কেন timer clear?

* user manually dismiss করলে auto-dismiss timer আর চলার দরকার নেই
* না হলে later setState কল হতে পারে

---

### 3) push(toastWithoutId)

```ts
const push = useCallback((t: Omit<ToastItem, "id">) => {
  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const item: ToastItem = { id, ...t };

  setToasts(prev => [item, ...prev].slice(0, 4));

  const tm = window.setTimeout(() => dismiss(id), 2800);
  timers.current.set(id, tm);

  return id;
}, [dismiss]);
```

এটার লজিক:

#### a) ID generate

* time + random combine করে unique বানানো

#### b) Toast add + limit 4

```ts
[item, ...prev].slice(0, 4)
```

* নতুন toast সবসময় উপরে
* সর্বোচ্চ 4টা রাখে (UI clutter কম)

#### c) Auto-dismiss

* 2.8 sec পরে dismiss(id)

✅ কেন `push` এ return id?

* চাইলে caller toast id save করে manual dismiss/track করতে পারে

---

### 4) Cleanup on unmount

```ts
useEffect(() => {
  return () => {
    timers.current.forEach(tm => window.clearTimeout(tm));
    timers.current.clear();
  };
}, []);
```

✅ কেন?
Component destroy হলে pending timers বন্ধ করা দরকার।
না হলে memory leak / warning হতে পারে।

---

### ✅ এই Toast system-এর “mental model”

* `push()` = toast যোগ করো + timer শুরু করো
* `dismiss()` = toast remove করো + timer বন্ধ করো
* `ToastHost` = toast list দেখাও

---

# 2) PreviewPanel.client.tsx (JPG preview display)

এটা খুব simple “presentational component”.

### Props

```ts
props: { jpgUrl: string | null }
```

### Logic

* `jpgUrl` null হলে message দেখায়: “render করলে দেখাবে”
* `jpgUrl` থাকলে `<img src={jpgUrl} />`

✅ এখানে jpgUrl হচ্ছে Blob URL (LabelsApp থেকে বানানো), তাই browser সহজে image render করতে পারে।

---

# 3) Tabs.client.tsx (Tab switcher)

### TabKey type

```ts
export type TabKey = "items" | "generate" | "preview";
```

✅ টাইপ ব্যবহার করার লাভ:

* ভুল tab string দিলে compile error
* `onChange` শুধু valid tab নিতে পারবে

### Controlled component

Props:

```ts
value: TabKey;       // current active tab (parent state)
onChange: (v) => void // parent state update
```

এখানে Tabs নিজে state রাখে না।
Parent (`LabelsApp`) tab state রাখে।

### Button factory function

```ts
const btn = (key, label) => { ... }
```

* `active = props.value === key`
* click করলে `props.onChange(key)`

✅ এটা reusable pattern: এক জায়গায় button rendering rules

### Render

```tsx
{btn("items", "📦 Items")}
{btn("generate", "🧾 Generate")}
{btn("preview", "🖼️ Preview")}
```

---

## Critical Considerations (বাংলা): শেখার জন্য সবচেয়ে দরকারি ৬টা পয়েন্ট

1. **useToasts হলো custom hook** → state + logic reuse করার জন্য
2. **useRef(Map)** → timer id store, re-render এ reset হয় না
3. **useCallback** → stable function reference (child props, timers)
4. **Controlled Tabs** → value + onChange pattern React-এর core concept
5. **PreviewPanel pure render** → logic কম, reusability বেশি
6. **Cleanup** (timeouts clear) → memory leak prevent

---

## ছোট but important improvement (optional, learning-friendly)

`push()` যখন 4টা limit করে slice করছে, পুরোনো toast drop হলে তার timer cleanup হচ্ছে না। (কারণ slice drop করেছে কিন্তু timer map এ থেকে গেছে)

Better approach:

* slice করার আগে extra toast ids বের করে timers clear করা
  এটা advanced—তুমি চাইলে আমি তোমার `useToasts()` টা “production safe” করে rewrite করে দেব (TypeScript strict + cleanup included)।

---

পরের ফাইলটা দাও: `lib/actions.ts` (সবচেয়ে গুরুত্বপূর্ণ)
এটা দেখলেই তোমার মাথায় clear হবে: **Server Actions দিয়ে কীভাবে file/PDF/preview কাজ করছে**।
