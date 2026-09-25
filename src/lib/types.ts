export type ModelId =
  | "gpt-5.6-luna"
  | "gpt-5.6-terra"
  | "gpt-5.6-sol"
  | "gpt-6-luna"
  | "gpt-6-sol"
  | "gpt-6-astra";

export type Effort =
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

export type Role = "user" | "assistant";

/** A file the user attached to a message. */
export type AttachmentKind = "image" | "pdf" | "text";

export interface Attachment {
  id: string;
  name: string;
  kind: AttachmentKind;
  mime: string;
  size: number;
  /** Data URL (base64) for image + pdf. */
  dataUrl?: string;
  /** Decoded contents for text/code files. */
  text?: string;
}

/** A web source cited by the model when web search is used. */
export interface Citation {
  url: string;
  title: string;
}

export type SearchStatus = "searching" | "searched";

export interface Message {
  id: string;
  role: Role;
  content: string;
  attachments?: Attachment[];
  /** Streamed reasoning-summary text (assistant only). */
  reasoning?: string;
  /** Seconds spent "thinking" (first reasoning delta → completed). */
  thoughtSeconds?: number;
  /** Set while the assistant message is actively streaming. */
  streaming?: boolean;
  /** Web-search progress + resulting sources (assistant only). */
  searchStatus?: SearchStatus;
  citations?: Citation[];
  /** Whether this user turn requested web search. */
  usedWebSearch?: boolean;
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
