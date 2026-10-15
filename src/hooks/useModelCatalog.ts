"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";
import { chatModelCatalog, modelName, type ModelDef } from "@/lib/models";

const manualModels = chatModelCatalog();

export function useModelCatalog(apiKey: string) {
  const [catalog, setCatalog] = useState<{ key: string; revision: number; models: ModelDef[]; imageModels: ModelDef[]; error: string }>({ key: "", revision: -1, models: [], imageModels: [], error: "" });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    if (!apiKey) return;
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [apiKey, refresh]);
  useEffect(() => {
    if (!apiKey) return;
    const controller = new AbortController();
    (async () => {
      try {
        const response = await apiFetch("/api/models", { headers: { "x-openai-key": apiKey }, signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message ?? "Could not load models.");
        if (controller.signal.aborted) return;
        const define = (items: { id: string }[]) => items.map((m) => ({ id: m.id, name: modelName(m.id) }));
        const models = chatModelCatalog(data.models);
        setCatalog({ key: apiKey, revision, models, imageModels: define(data.imageModels), error: "" });
      } catch (error) {
        if (!controller.signal.aborted) setCatalog((previous) => ({ key: apiKey, revision, models: previous.key === apiKey && previous.models.length ? previous.models : manualModels, imageModels: previous.key === apiKey ? previous.imageModels : [], error: error instanceof Error ? error.message : "Could not load models." }));
      }
    })();
    return () => controller.abort();
  }, [apiKey, revision]);
  const current = !!apiKey && catalog.key === apiKey;
  return { models: current ? catalog.models : manualModels, imageModels: current ? catalog.imageModels : [], loading: !!apiKey && (!current || catalog.revision !== revision), error: current && catalog.revision === revision ? catalog.error : "", refresh };
}
