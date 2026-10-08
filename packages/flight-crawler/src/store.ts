import { jsonSink } from "./sinks/json.js";
import { pgliteSink } from "./sinks/pglite.js";
import { supabaseSink } from "./sinks/supabase.js";
import type { Sink } from "./sinks/types.js";

export type StoreName = "local" | "supabase" | "json";

/** A Supabase *secret* key: new-style `sb_secret_…` or the legacy service-role JWT. */
const isSecretKey = (k: string | undefined) => !!k && (k.startsWith("sb_secret_") || k.startsWith("eyJ"));

export interface ChosenStore {
  sink: Sink;
  name: StoreName;
  /** Why a store was chosen / rejected — printed once by the CLI. */
  note: string;
}

/**
 * Pick where fares are stored.
 * - `--store` wins when given.
 * - Otherwise Supabase when both vars are present *and* the key can actually write
 *   (a publishable/anon key would be rejected with 401, so it falls back instead).
 * - Otherwise the durable local store, so the hourly crawl always collects something.
 */
export function chooseStore(env: NodeJS.ProcessEnv, opts: { store?: string; dryRun?: boolean } = {}): ChosenStore {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (opts.dryRun && !opts.store) {
    return { sink: jsonSink(), name: "json", note: "dry-run → JSON file in out/" };
  }
  if (opts.store === "json") return { sink: jsonSink(), name: "json", note: "--store json" };
  if (opts.store === "supabase" || (opts.store !== "local" && url && isSecretKey(key))) {
    if (!url || !key) throw new Error("--store supabase needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    return { sink: supabaseSink(url, key), name: "supabase", note: `Supabase ${new URL(url).host}` };
  }
  const why = !url
    ? "SUPABASE_URL missing"
    : !key
      ? "SUPABASE_SERVICE_ROLE_KEY missing"
      : "SUPABASE_SERVICE_ROLE_KEY is a publishable key (cannot write; use the project's secret key)";
  return { sink: pgliteSink(), name: "local", note: `local store data/fares — ${why}` };
}
