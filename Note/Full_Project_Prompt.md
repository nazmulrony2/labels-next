চমৎকার প্রশ্ন 👍
তুমি আসলে চাচ্ছো এমন একটা **structured project description / system prompt** যেটা পরে যেকোনো LLM (ChatGPT, Claude, Gemini ইত্যাদি) কে দিলে সে পুরো application context বুঝে নিতে পারে।

আমি নিচে তোমার **Next.js Labels Generator Application**–এর জন্য একটি সম্পূর্ণ, structured, LLM-ready project description দিচ্ছি। তুমি চাইলে এটা সরাসরি prompt হিসেবে ব্যবহার করতে পারবে।

---

# ✅ PROJECT CONTEXT DOCUMENT

*(LLM Prompt Ready Description)*

---

## 🧾 Project Name

**Labels Grid PDF Generator (Next.js + Server Actions)**

---

## 🎯 Project Goal

This application allows users to:

1. Upload PNG images (with optional transparency)
2. Store them as named registry items
3. Search and select saved items
4. Generate multi-page PDF labels using a fixed grid layout (95×150mm page, 9×3 grid)
5. Render a JPG preview of the first page
6. Customize layout settings (margins, gaps, repeat count, scaling, borders)
7. View selected item thumbnail
8. Receive toast notifications for success/error
9. Navigate via Tabs (Items / Generate / Preview)

The application replicates a previous Streamlit app but is implemented using **Next.js App Router + Server Actions**.

---

# 🏗️ Architecture Overview

The application follows a 3-layer architecture:

```
Client UI (React components)
        ↓
Server Actions (lib/actions.ts)
        ↓
Core Logic (pdf.ts / preview.ts / storage.ts)
```

---

# 🗂 Folder Structure

```
app/
  page.tsx

components/
  LabelsApp.client.tsx
  ItemsPanel.client.tsx
  SettingsPanel.client.tsx
  PreviewPanel.client.tsx
  Tabs.client.tsx
  ToastHost.client.tsx

lib/
  actions.ts
  storage.ts
  pdf.ts
  preview.ts
  types.ts
  constants.ts

data/
  items_registry.json
  items/*.png
```

---

# 🧠 Core Concepts

## 1️⃣ Client Components

All interactive UI components are client components:

* `"use client"` is used.
* State is managed using React hooks.
* File uploads and UI events are handled in browser.
* Server logic is triggered via Server Actions.

---

## 2️⃣ Server Actions (Backend Logic)

All heavy operations are executed server-side:

* Save PNG file
* Delete file
* Generate PDF
* Render JPG preview
* Load registry items
* Load PNG thumbnail

Server Actions return structured responses:

```ts
{
  ok: boolean;
  data?: T;
  error?: string;
}
```

Client checks `ok` before using `data`.

---

# 📦 Data Model

## RegistryItem

Each saved item has:

```
id: string
name: string
type: "image"
value: string (file path)
```

Registry is stored in:

```
data/items_registry.json
```

PNG files stored in:

```
data/items/
```

---

# 🖼 Upload Flow

1. User selects PNG file
2. File is converted to base64 (browser side)
3. `savePngItemAction()` is called
4. Server:

   * decodes base64
   * saves file
   * updates registry
5. Client:

   * updates local state
   * selects new item
   * shows success toast

---

# 🗑 Delete Flow

1. User clicks delete
2. `deleteItemAction(id)` is called
3. Server:

   * removes from registry
   * deletes PNG file
4. Client:

   * updates items state
   * resets selectedId
   * clears previews
   * shows toast

---

# 🧾 PDF Generation Logic

PDF is generated server-side using:

* Fixed page size: 95mm × 150mm
* Fixed grid: 9 columns × 3 rows
* Cell size: 10mm × 50mm

User-configurable options:

* Pages count
* Margins
* Column/Row gaps
* Repeat per cell
* Image scale
* Padding
* Border options
* Cut guide lines

Algorithm:

1. Convert mm → points
2. Calculate grid total width/height
3. Loop rows and columns
4. Compute cell positions
5. Inside each cell:

   * Repeat vertically
   * Apply scaling
   * Apply padding
   * Draw image
6. Repeat for each page
7. Return PDF bytes → base64

---

# 🖼 JPG Preview Logic

Preview renders first page only.

Steps:

1. Convert mm → px using DPI
2. Create blank canvas
3. Calculate grid positions
4. Resize PNG using:

   * contain OR
   * cover mode
5. Draw image into cell
6. Return JPG bytes → base64

---

# 🔁 Thumbnail Logic

When `selectedId` changes:

1. Server reads PNG file
2. Converts to base64
3. Client converts base64 → Blob URL
4. Mini preview is shown

Old object URLs are revoked to prevent memory leaks.

---

# 🔄 UI State Logic

Main controller: `LabelsApp.client.tsx`

State includes:

* items
* selectedId
* query
* tab
* pdfSettings
* previewSettings
* pdfUrl
* jpgUrl
* thumbUrl
* busy

Tabs:

* Items → upload/search/select
* Generate → PDF actions
* Preview → display output

---

# 🔔 Toast System

Custom toast system:

* Stores up to 4 toasts
* Auto-dismiss after ~3 seconds
* Types:

  * success
  * error
  * info

Used for:

* Save success
* Delete success
* PDF ready
* Preview ready
* Errors

---

# 🔐 Important Constraints

* Only PNG files supported
* PDF generation always uses fixed page/grid
* Local filesystem persistence (not production-ready for Vercel)
* No database (JSON-based registry)
* Base64 used for binary transfer

---

# 🚀 Technologies Used

* Next.js App Router
* React Client Components
* Server Actions
* TypeScript (strict typing)
* Local filesystem storage
* Blob URL for binary preview
* Tailwind CSS (v4)

---

# 🧩 Key Design Decisions

1. Server Actions instead of API routes
2. Base64 transport for binary files
3. Local JSON registry instead of database
4. Separation of concerns:

   * UI
   * Server logic
   * Rendering logic
5. Controlled inputs for all forms
6. Memory-safe object URL handling

---

# 🧠 Mental Model Summary

This is a:

> Client-driven UI
>
> * Server-driven file processing
> * Deterministic grid-based PDF rendering tool

It is not an LLM app.
It is a deterministic layout generator tool.

---

# 📌 How to Explain This App in One Sentence

> A Next.js application that allows users to upload PNG symbols and generate multi-page printable label PDFs using a fixed 9×3 grid layout with customizable spacing and preview rendering.

---

# 🔥 Optional: Ultra-Compact Prompt Version

If you want a short version for LLM:

```
This is a Next.js App Router project using Server Actions.
It allows uploading PNG files, storing them in a JSON registry,
and generating multi-page 95×150mm PDFs using a fixed 9×3 grid.
PDF rendering is server-side. Preview rendering generates a JPG of the first page.
Binary files are transferred as base64 and converted to Blob URLs in the client.
The app uses tabs (Items/Generate/Preview), thumbnail preview,
and toast notifications for UX feedback.
Local filesystem persistence only.
```

---

যদি তুমি চাও, আমি এখন:

* 🔹 Production-ready migration version (Supabase + Storage) এর architecture লিখে দিতে পারি
* 🔹 অথবা এই app কে SaaS product বানানোর architecture plan দিতে পারি
* 🔹 অথবা LLM দিয়ে automatic layout suggestion system যোগ করার design দিতে পারি

তুমি কোন দিকে এগোতে চাও?
