import type { ModelId, Effort, ImageSize, ImageModelId, DocFormat } from "./types";

export interface ModelDef {
  id: ModelId;
  name: string;
}

export const ALL_MODELS: ModelDef[] = [
  { id: "gpt-6-astra", name: "GPT-6 Astra" },
  { id: "gpt-6-sol", name: "GPT-6 Sol" },
  { id: "gpt-6-luna", name: "GPT-6 Luna" },
  { id: "gpt-5.6-sol", name: "GPT-5.6 Sol" },
  { id: "gpt-5.6-terra", name: "GPT-5.6 Terra" },
  { id: "gpt-5.6-luna", name: "GPT-5.6 Luna" },
];

export const DEFAULT_MODEL: ModelId = "gpt-6-luna";

export function modelName(id: ModelId): string {
  return ALL_MODELS.find((m) => m.id === id)?.name ?? id;
}

/* ── Image generation ──────────────────────────────────────────────────────
   GPT Image models (may require OpenAI org verification; access errors surface
   inline like any other API error). */

export interface ImageModelDef {
  id: ImageModelId;
  name: string;
}

export const IMAGE_MODELS: ImageModelDef[] = [
  { id: "gpt-image-2.5-sunburst", name: "GPT Image 2.5 Sunburst" },
  { id: "gpt-image-2.5-flare", name: "GPT Image 2.5 Flare" },
  { id: "gpt-image-2", name: "GPT Image 2" },
  { id: "gpt-image-1.5", name: "GPT Image 1.5" },
  { id: "gpt-image-1", name: "GPT Image 1" },
];

export const DEFAULT_IMAGE_MODEL: ImageModelId = "gpt-image-2.5-flare";

export function imageModelName(id: ImageModelId): string {
  return IMAGE_MODELS.find((m) => m.id === id)?.name ?? id;
}

export interface ImageSizeOption {
  value: ImageSize;
  label: string;
}

export const IMAGE_SIZES: ImageSizeOption[] = [
  { value: "1024x1024", label: "Square" },
  { value: "1024x1536", label: "Portrait" },
  { value: "1536x1024", label: "Landscape" },
];

export const DEFAULT_IMAGE_SIZE: ImageSize = "1024x1024";

export function imageSizeLabel(value: ImageSize): string {
  return IMAGE_SIZES.find((s) => s.value === value)?.label ?? value;
}

/* ── Documents mode ────────────────────────────────────────────────────────
   Output formats for a transformed document (PDF is server-rendered with
   selectable text + math; MD/TXT are produced client-side from the reply). */

export interface DocFormatOption {
  value: DocFormat;
  label: string;
}

export const DOC_FORMATS: DocFormatOption[] = [
  { value: "pdf", label: "PDF" },
  { value: "markdown", label: "Markdown" },
  { value: "text", label: "Text" },
];

export const DEFAULT_DOC_FORMAT: DocFormat = "pdf";

export function docFormatLabel(value: DocFormat): string {
  return DOC_FORMATS.find((f) => f.value === value)?.label ?? value;
}

/** ChatGPT "thinking effort" slider stops → OpenAI reasoning.effort values. */
export interface EffortStop {
  label: string;
  value: Effort;
}

export const EFFORT_STOPS: EffortStop[] = [
  { label: "None", value: "none" },
  { label: "Minimal", value: "minimal" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Extra High", value: "xhigh" },
  { label: "Max", value: "max" },
];

export const DEFAULT_EFFORT: Effort = "medium";

export function effortLabel(value: Effort): string {
  return EFFORT_STOPS.find((s) => s.value === value)?.label ?? value;
}

export function effortIndex(value: Effort): number {
  const i = EFFORT_STOPS.findIndex((s) => s.value === value);
  return i < 0 ? EFFORT_STOPS.findIndex((s) => s.value === DEFAULT_EFFORT) : i;
}
