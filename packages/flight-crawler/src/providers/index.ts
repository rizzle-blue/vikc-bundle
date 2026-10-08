import type { FlightProvider } from "../types.js";
import { vietnamAirlines } from "./vietnam-airlines.js";

// Providers are tried in order; add new adapters here.
// VietJet has no usable public endpoint (signed + WAF-protected) → its adapter drives the
// real booking UI in a browser and reads the JSON the page itself receives (see
// docs/tasks/T5-vietjet-browser-adapter.md). Never re-implement their signing or evade a block.
export const providers: FlightProvider[] = [vietnamAirlines];
