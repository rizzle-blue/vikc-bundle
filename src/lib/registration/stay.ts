import { HANOI_NIGHTS, TAM_CHUC_NIGHTS, WINDOW, addDays, dayRange, diffMinutes, vnDate } from "./trip.js";

/** One member's trip row: the two datetimes are the input, everything else is derived. */
export interface TripRow {
  memberId: string;
  fullName?: string;
  arrivalAt: string | null;
  departureAt: string | null;
  roomType?: string | null;
  roommate?: string | null;
  examGrade?: string | null;
  team3?: boolean;
  team5?: boolean;
  dojoExchange?: boolean;
  notes?: string | null;
}

export type Warning = "departure-before-arrival" | "outside-window" | "nights-outside-legs" | "missing-datetime";

export interface Stay {
  /** nights spent in Vietnam (departure day − arrival day) */
  nights: number;
  /** calendar days present = nights + 1 */
  days: number;
  /** nights dated 18–22/11 (Tam Chúc leg, incl. the VKF-package night of 21/11) */
  tamChucNights: number;
  /** nights dated 23–29/11 (Hà Nội leg) */
  haNoiNights: number;
  /** nights falling outside both legs (a date outside the delegation window) */
  outsideNights: number;
  warnings: Warning[];
}

const inRange = (day: string, from: string, to: string) => day >= from && day <= to;

/**
 * Derive the stay from the two datetimes. A "night" is dated by its check-in day — the same
 * convention a hotel bill uses — so arriving 18/11 and leaving 22/11 is 4 nights (18,19,20,21).
 */
export function deriveStay(row: Pick<TripRow, "arrivalAt" | "departureAt">): Stay {
  const { arrivalAt, departureAt } = row;
  if (!arrivalAt || !departureAt) {
    return { nights: 0, days: 0, tamChucNights: 0, haNoiNights: 0, outsideNights: 0, warnings: ["missing-datetime"] };
  }
  const warnings: Warning[] = [];
  if (diffMinutes(arrivalAt, departureAt) <= 0) {
    return { nights: 0, days: 0, tamChucNights: 0, haNoiNights: 0, outsideNights: 0, warnings: ["departure-before-arrival"] };
  }

  const arriveDay = vnDate(arrivalAt);
  const departDay = vnDate(departureAt);
  const nights = Math.max(0, dayRange(arriveDay, departDay).length - 1);

  if (arriveDay < WINDOW.from || departDay > WINDOW.to) warnings.push("outside-window");

  let tamChucNights = 0;
  let haNoiNights = 0;
  for (let i = 0; i < nights; i++) {
    const night = addDays(arriveDay, i);
    if (inRange(night, TAM_CHUC_NIGHTS.from, TAM_CHUC_NIGHTS.to)) tamChucNights++;
    else if (inRange(night, HANOI_NIGHTS.from, HANOI_NIGHTS.to)) haNoiNights++;
  }
  const outsideNights = nights - tamChucNights - haNoiNights;
  if (outsideNights > 0) warnings.push("nights-outside-legs");

  return { nights, days: nights + 1, tamChucNights, haNoiNights, outsideNights, warnings };
}

/** VN days the member is present: arrival day through departure day (inclusive). */
export function presenceDays(row: Pick<TripRow, "arrivalAt" | "departureAt">): string[] {
  const { arrivalAt, departureAt } = row;
  if (!arrivalAt || !departureAt) return [];
  const from = vnDate(arrivalAt);
  const to = vnDate(departureAt);
  return to < from ? [] : dayRange(from, to);
}

export interface DayCount {
  day: string;
  /** members known to be there that day (a missing departure means "still here") */
  present: number;
  /** members whose whole stay is known and covers that day */
  confirmed: number;
  /** true inside the VIKC window (19–22/11) / the Hà Nội window (23–29/11) */
  vikcDay: boolean;
  haNoiDay: boolean;
}

/** Headcount per day across the delegation window. */
export function headcountByDay(rows: TripRow[], from = WINDOW.from, to = WINDOW.to): DayCount[] {
  return dayRange(from, to).map((day) => {
    let present = 0;
    let confirmed = 0;
    for (const row of rows) {
      if (!row.arrivalAt) continue;
      const arrive = vnDate(row.arrivalAt);
      if (arrive > day) continue;
      if (!row.departureAt) {
        present++;
        continue;
      }
      const depart = vnDate(row.departureAt);
      if (depart < day) continue;
      present++;
      confirmed++;
    }
    return {
      day,
      present,
      confirmed,
      vikcDay: day >= "2026-11-19" && day <= "2026-11-22",
      haNoiDay: day >= "2026-11-23" && day <= "2026-11-29",
    };
  });
}

export type Progress = "missing" | "partial" | "complete";

/** `complete` needs both datetimes + the room type we must book; anything partly filled is `partial`. */
export function progressOf(row: TripRow): Progress {
  const filled = [row.arrivalAt, row.departureAt, row.roomType].filter(Boolean).length;
  if (filled === 0) return "missing";
  return filled === 3 ? "complete" : "partial";
}

export interface Summary {
  total: number;
  complete: number;
  partial: number;
  missing: number;
  /** members with both datetimes filled in */
  withDatetimes: number;
  totalNights: number;
  avgNights: number;
}

export function summarize(rows: TripRow[]): Summary {
  const stays = rows.map((r) => deriveStay(r));
  const withDatetimes = stays.filter((s) => !s.warnings.includes("missing-datetime")).length;
  const totalNights = stays.reduce((sum, s) => sum + s.nights, 0);
  return {
    total: rows.length,
    complete: rows.filter((r) => progressOf(r) === "complete").length,
    partial: rows.filter((r) => progressOf(r) === "partial").length,
    missing: rows.filter((r) => progressOf(r) === "missing").length,
    withDatetimes,
    totalNights,
    avgNights: withDatetimes ? Math.round((totalNights / withDatetimes) * 10) / 10 : 0,
  };
}
