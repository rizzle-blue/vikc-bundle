import { parseArgs } from "node:util";
import { createFx } from "./money.js";
import { providers } from "./providers/index.js";
import { allFailed, runCrawl } from "./runner.js";
import { chooseStore } from "./store.js";
import { SearchQuery } from "./types.js";

for (const f of [".env", "../../.env"]) {
  try {
    process.loadEnvFile(f);
  } catch {
    /* optional */
  }
}

const { values: a } = parseArgs({
  options: {
    provider: { type: "string" },
    from: { type: "string" },
    to: { type: "string" },
    date: { type: "string" },
    return: { type: "string" },
    store: { type: "string" }, // local | supabase | json
    report: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
  },
});

const env = process.env;
const { sink, name, note } = chooseStore(env, { store: a.store, dryRun: a["dry-run"] });
console.log(`[store] ${name} — ${note}`);

if (a.report) {
  console.log(await sink.report());
  await sink.close();
  process.exit(0);
}

const searches =
  a.from && a.to && a.date
    ? [SearchQuery.parse({ id: null, origin: a.from.toUpperCase(), destination: a.to.toUpperCase(), departDate: a.date, returnDate: a.return ?? null })]
    : await sink.loadSearches();

const selected = a.provider ? providers.filter((p) => p.id.startsWith(a.provider!)) : providers;
if (!selected.length) throw new Error(`no provider matches "${a.provider}"`);

const runs = await runCrawl({
  providers: selected,
  searches,
  sink,
  ctx: { fetch, env, toVnd: createFx(fetch) },
});
const ok = runs.filter((r) => r.status === "ok").length;
console.log(`[store] ${name}: ${ok}/${runs.length} provider runs ok`);
await sink.close();
if (allFailed(runs)) {
  console.error("all provider runs failed");
  process.exit(1);
}
