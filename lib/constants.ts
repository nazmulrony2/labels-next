// labels-next/lib/constants.ts

// ✅ কেন: Page/grid spec fixed রাখলে print scaling mismatch কম হয় (Streamlit এর মতোই)
export const pageSpec = {
  pageWMm: 95.0,
  pageHMm: 150.0,
} as const;

export const gridSpec = {
  cols: 9,
  rows: 3,
  colWMm: 10.0,
  rowHMm: 50.0,
} as const;

// ✅ কেন: local storage paths এক জায়গায় রাখলে maintain সহজ
export const storageSpec = {
  itemsDir: "data/items",
  registryFile: "data/items_registry.json",
} as const;