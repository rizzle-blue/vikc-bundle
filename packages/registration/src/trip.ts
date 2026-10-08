/** Trip facts (VIKC 2026, Shakaijin delegation). VN calendar dates, all in Asia/Ho_Chi_Minh. */
export const TZ = "Asia/Ho_Chi_Minh";

/** Delegation window we track: first possible arrival … last possible departure. */
export const WINDOW = { from: "2026-11-18", to: "2026-11-30" } as const;
/** Tam Chúc leg — VIKC 19–22/11/2026 (nights dated 18–22/11). */
export const VIKC = { from: "2026-11-19", to: "2026-11-22" } as const;
/** Hà Nội leg — dojo exchange 23–29/11/2026 (nights dated 23–29/11). */
export const HANOI = { from: "2026-11-23", to: "2026-11-29" } as const;
/** Night ranges (a night is dated by its check-in day): Tam Chúc leg, then Hà Nội leg. */
export const TAM_CHUC_NIGHTS = { from: "2026-11-18", to: "2026-11-22" } as const;
export const HANOI_NIGHTS = { from: "2026-11-23", to: "2026-11-29" } as const;
/** VKF deadlines. */
export const DEADLINES = { register: "2026-10-20", pay: "2026-10-25" } as const;

/** Calendar date (YYYY-MM-DD) of an instant, in Vietnam. */
export function vnDate(at: string | Date): string {
  const d = typeof at === "string" ? new Date(at) : at;
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Minutes between two instants (b - a). */
export function diffMinutes(a: string | Date, b: string | Date): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Inclusive list of dates between two YYYY-MM-DD. */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  const n = daysBetween(from, to);
  for (let i = 0; i <= n; i++) out.push(new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));
  return out;
}

/** Add days to a YYYY-MM-DD. */
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Days from today (local) until a trip date; negative = passed. */
export function daysUntil(day: string, now = new Date()): number {
  return daysBetween(vnDate(now), day);
}
