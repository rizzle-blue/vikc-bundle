import type { SearchQuery } from "./types.js";

// Mirrors supabase/seed.sql; used for --dry-run without a database.
// Round-trip rows feed the VNA fare calendar; the one-way legs are for the VietJet
// browser adapter (VNA's endpoint cannot answer one-way queries).
export const DEFAULT_SEARCHES: SearchQuery[] = [
  { id: null, origin: "SGN", destination: "HAN", departDate: "2026-11-18", returnDate: null, adults: 1 },
  { id: null, origin: "SGN", destination: "HAN", departDate: "2026-11-19", returnDate: null, adults: 1 },
  { id: null, origin: "HAN", destination: "SGN", departDate: "2026-11-22", returnDate: null, adults: 1 },
  { id: null, origin: "HAN", destination: "SGN", departDate: "2026-11-29", returnDate: null, adults: 1 },
  { id: null, origin: "SGN", destination: "HAN", departDate: "2026-11-18", returnDate: "2026-11-22", adults: 1 },
  { id: null, origin: "SGN", destination: "HAN", departDate: "2026-11-18", returnDate: "2026-11-29", adults: 1 },
];
