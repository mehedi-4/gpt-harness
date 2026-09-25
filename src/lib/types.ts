export type ModelId =
  | "gpt-5.6-luna"
  | "gpt-5.6-terra"
  | "gpt-5.6-sol"
  | "gpt-6-luna"
  | "gpt-6-sol"
  | "gpt-6-astra";

export type Effort = "medium" | "high" | "xhigh";

export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  content: string;
  /** Streamed reasoning-summary text (assistant only). */
  reasoning?: string;
  /** Seconds spent "thinking" (first reasoning delta → completed). */
  thoughtSeconds?: number;
  /** Set while the assistant message is actively streaming. */
  streaming?: boolean;
  /** Error message to render in place of content. */
  error?: string;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  model: ModelId;
  effort: Effort;
  createdAt: number;
  updatedAt: number;
}
