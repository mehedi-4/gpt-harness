import type { ModelId, Effort } from "./types";

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
