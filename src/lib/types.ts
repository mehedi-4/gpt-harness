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
  /** Data URL (base64) for image + pdf. Transient: kept in memory for the model
   *  call, stripped before persistence (the hosted `url` is stored instead). */
  dataUrl?: string;
  /** Cloudinary-hosted URL for image + pdf. This is what persists. */
  url?: string;
  /** Decoded contents for text/code files. */
  text?: string;
}

/** A web source cited by the model when web search is used. */
export interface Citation {
  url: string;
  title: string;
}

export type SearchStatus = "searching" | "searched";

/** Output aspect for image generation. */
export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024";

/** Selectable image-generation model. */
export type ImageModelId =
  | "gpt-image-2.5-sunburst"
  | "gpt-image-2.5-flare"
  | "gpt-image-2"
  | "gpt-image-1.5"
  | "gpt-image-1";

/** Output format for a generated document. */
export type DocFormat = "pdf" | "markdown" | "text";

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
  /** The query terms the model searched for (in order, deduped). */
  searchQueries?: string[];
  citations?: Citation[];
  /** Whether this user turn requested web search. */
  usedWebSearch?: boolean;
  /** Image-generation turn (assistant only): render images instead of markdown. */
  isImage?: boolean;
  /** Generated image data URLs (assistant only). */
  images?: string[];
  /** Document-generation turn (assistant only): render markdown + download UI. */
  isDocument?: boolean;
  /** Chosen output format for a document turn. */
  docFormat?: DocFormat;
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
