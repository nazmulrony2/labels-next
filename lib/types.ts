// labels-next/lib/types.ts

// ✅ কেন: Streamlit TypedDict এর সমতুল্য TS types দিয়ে data shape fixed রাখি
export type ItemType = "image";

export interface RegistryItem {
  id: string;
  name: string;
  type: ItemType;
  value: string; // ✅ কেন: local file path (ex: data/items/xxx.png)
}

// ✅ কেন: Settings গুলো typed হলে form/slider values safe থাকে
export type ImageFitMode = "contain" | "cover";

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

export interface PreviewSettings {
  showPreview: boolean;
  previewDpi: number;
  fullPage: boolean;
}