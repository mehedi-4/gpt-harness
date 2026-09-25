import type { ModelId, Effort } from "./types";

export interface ModelDef {
  id: ModelId;
  name: string;
  description: string;
}

export interface ModelFamily {
  label: string;
  models: ModelDef[];
}

export const MODEL_FAMILIES: ModelFamily[] = [
  {
    label: "GPT-6",
    models: [
      { id: "gpt-6-astra", name: "GPT-6 Astra", description: "Frontier model for the hardest work" },
      { id: "gpt-6-sol", name: "GPT-6 Sol", description: "Next-gen deep reasoning" },
      { id: "gpt-6-luna", name: "GPT-6 Luna", description: "Next-gen, fast and efficient" },
    ],
  },
  {
    label: "GPT-5.6",
    models: [
      { id: "gpt-5.6-sol", name: "GPT-5.6 Sol", description: "Great for complex, professional work" },
      { id: "gpt-5.6-terra", name: "GPT-5.6 Terra", description: "Balanced reasoning and speed" },
      { id: "gpt-5.6-luna", name: "GPT-5.6 Luna", description: "Fastest for everyday tasks" },
    ],
  },
];

export const ALL_MODELS: ModelDef[] = MODEL_FAMILIES.flatMap((f) => f.models);

export const DEFAULT_MODEL: ModelId = "gpt-5.6-terra";

export function modelName(id: ModelId): string {
  return ALL_MODELS.find((m) => m.id === id)?.name ?? id;
}

/** ChatGPT "thinking effort" slider stops → OpenAI reasoning.effort values. */
export interface EffortStop {
  label: string;
  value: Effort;
}

export const EFFORT_STOPS: EffortStop[] = [
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Extra High", value: "xhigh" },
];

export const DEFAULT_EFFORT: Effort = "medium";

export function effortLabel(value: Effort): string {
  return EFFORT_STOPS.find((s) => s.value === value)?.label ?? value;
}
