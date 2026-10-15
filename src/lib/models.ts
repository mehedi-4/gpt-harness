import type { ModelId, Effort, ImageSize, ImageModelId } from "./types";

export interface ModelDef {
  id: ModelId;
  name: string;
}

export const DEFAULT_MODEL: ModelId = "gpt-6-luna";

export function modelName(id: ModelId): string {
  return id.replace(/^gpt-/, "GPT-").replace(/-([a-z])/g, (_, c: string) => ` ${c.toUpperCase()}`);
}

/* ── Image generation ──────────────────────────────────────────────────────
   GPT Image models (may require OpenAI org verification; access errors surface
   inline like any other API error). */

export interface ImageModelDef {
  id: ImageModelId;
  name: string;
}

export const DEFAULT_IMAGE_MODEL: ImageModelId = "";

export function imageModelName(id: ImageModelId): string {
  return id ? modelName(id) : "Choose image model";
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
