import { MongoClient, type Db, type Collection } from "mongodb";

/**
 * MongoDB (Atlas) connection + index init. Server-only (imported exclusively
 * from repo.ts / route handlers). The client is a singleton cached on globalThis
 * so Next's dev hot-reload doesn't open a new connection pool per edit, and the
 * indexes are ensured exactly once per process.
 *
 * Storage model: binaries (uploaded images/PDFs, generated images) live in
 * Cloudinary — Mongo stores only their hosted URLs + metadata, never base64.
 */

declare global {
  var __chatMongo: MongoClient | undefined;
  var __chatIndexesReady: Promise<void> | undefined;
}

const DB_NAME = "chat";

/** Shape of a conversation document (camelCase — stored as-is, no mapping). */
export interface ConversationDoc {
  id: string;
  title: string;
  model: string;
  effort: string;
  createdAt: number;
  updatedAt: number;
}

/** Shape of a message document. `seq` is a per-conversation monotonic counter. */
export interface MessageDoc {
  id: string;
  conversationId: string;
  seq: number;
  role: string;
  content: string;
  reasoning?: string;
  thoughtSeconds?: number;
  searchStatus?: string;
  searchQueries?: string[];
  citations?: { url: string; title: string }[];
  usedWebSearch?: boolean;
  isImage?: boolean;
  images?: string[];
  isDocument?: boolean;
  docFormat?: string;
  attachments?: unknown[];
  error?: string;
  createdAt: number;
}

function makeClient(): MongoClient {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set.");
  }
  return new MongoClient(uri);
}

/** Lazily create (and cache) the connected client. Deferred so build-time module
 * evaluation (Next collecting page data) never needs MONGODB_URI. */
export function getClient(): MongoClient {
  if (!global.__chatMongo) global.__chatMongo = makeClient();
  return global.__chatMongo;
}

export function getDb(): Db {
  return getClient().db(DB_NAME);
}

export function conversationsCol(): Collection<ConversationDoc> {
  return getDb().collection<ConversationDoc>("conversations");
}

export function messagesCol(): Collection<MessageDoc> {
  return getDb().collection<MessageDoc>("messages");
}

/** Create indexes exactly once per process (awaited by every repo call). */
export function ensureIndexes(): Promise<void> {
  if (!global.__chatIndexesReady) {
    global.__chatIndexesReady = (async () => {
      await conversationsCol().createIndex({ id: 1 }, { unique: true });
      await conversationsCol().createIndex({ updatedAt: -1 });
      await messagesCol().createIndex({ id: 1 }, { unique: true });
      await messagesCol().createIndex({ conversationId: 1, seq: 1 });
    })();
  }
  return global.__chatIndexesReady;
}
