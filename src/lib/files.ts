import type { Attachment, AttachmentKind } from "./types";

/** Per-file size ceiling. Base64 in localStorage is heavy, so keep it modest. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "csv", "tsv", "log", "rtf",
  "json", "jsonl", "yaml", "yml", "toml", "ini", "cfg", "conf", "env",
  "xml", "html", "htm", "css", "scss", "sass", "less",
  "js", "jsx", "ts", "tsx", "mjs", "cjs",
  "py", "rb", "go", "rs", "java", "kt", "kts", "c", "h", "cpp", "cc", "hpp",
  "cs", "swift", "m", "mm", "php", "pl", "lua", "r", "dart", "scala", "clj",
  "sh", "bash", "zsh", "fish", "ps1", "bat", "cmd",
  "sql", "graphql", "gql", "proto", "dockerfile", "makefile", "gitignore",
  "vue", "svelte", "astro", "tf", "hcl", "gradle", "properties",
]);

function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : name.toLowerCase();
}

export function classify(file: File): AttachmentKind {
  const mime = file.type;
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf" || extOf(file.name) === "pdf") return "pdf";
  if (mime.startsWith("text/")) return "text";
  if (
    mime === "application/json" ||
    mime === "application/xml" ||
    mime === "application/javascript" ||
    mime === "application/x-yaml" ||
    mime === "application/x-sh"
  ) {
    return "text";
  }
  // Fall back to extension (many code files report an empty or generic MIME).
  return TEXT_EXTENSIONS.has(extOf(file.name)) ? "text" : "text";
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.readAsText(file);
  });
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export interface FileReadResult {
  attachment?: Attachment;
  error?: string;
}

/** Reads one File into an Attachment, or returns a human-readable error. */
export async function readFile(file: File): Promise<FileReadResult> {
  if (file.size > MAX_FILE_BYTES) {
    return {
      error: `${file.name} is too large (max ${MAX_FILE_BYTES / (1024 * 1024)} MB).`,
    };
  }

  const kind = classify(file);
  const base = {
    id: uid(),
    name: file.name || "file",
    kind,
    mime: file.type || "application/octet-stream",
    size: file.size,
  };

  try {
    if (kind === "image" || kind === "pdf") {
      const dataUrl = await readAsDataUrl(file);
      return { attachment: { ...base, dataUrl } };
    }
    const text = await readAsText(file);
    return { attachment: { ...base, text } };
  } catch {
    return { error: `Could not read ${file.name}.` };
  }
}

export async function readFiles(
  files: FileList | File[],
): Promise<{ attachments: Attachment[]; errors: string[] }> {
  const results = await Promise.all(Array.from(files).map(readFile));
  const attachments: Attachment[] = [];
  const errors: string[] = [];
  for (const r of results) {
    if (r.attachment) attachments.push(r.attachment);
    if (r.error) errors.push(r.error);
  }
  return { attachments, errors };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
