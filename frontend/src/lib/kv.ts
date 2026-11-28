import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Private storage for the admin-only trackers (todos, weekly drafts), in
 * Upstash Redis. Vercel's Upstash integration sets KV_REST_API_URL and
 * KV_REST_API_TOKEN; a database created on upstash.com directly uses the
 * UPSTASH_REDIS_REST_* names. Either works.
 */
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

export const kvConfigured = Boolean(url && token);

let client: Redis | undefined;
export function kv(): Redis {
  if (!kvConfigured) throw new Error("Upstash Redis isn't connected. Add the Upstash for Redis integration in Vercel.");
  client ??= new Redis({ url, token });
  return client;
}

/** Every key this site writes starts with this, so the database can be shared safely. */
export const KEY_PREFIX = "devtracker:";
