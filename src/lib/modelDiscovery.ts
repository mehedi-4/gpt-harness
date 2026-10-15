export interface AvailableModel { id: string; created?: number }

/** Text GPT generations 6+, excluding API families that need other endpoints. */
export function isChatModel(id: unknown): id is string {
  if (typeof id !== "string") return false;
  const match = /^gpt-(\d+)(?:[.-]|$)/.exec(id);
  return !!match && Number(match[1]) >= 6 && !/(?:^|-)(?:audio|realtime|transcribe|tts|image|search)(?:-|$)/.test(id);
}

export function newestChatModels(models: AvailableModel[]): AvailableModel[] {
  return models.filter((m) => isChatModel(m.id)).sort((a, b) =>
    b.id.localeCompare(a.id, undefined, { numeric: true }) || (b.created ?? 0) - (a.created ?? 0));
}
