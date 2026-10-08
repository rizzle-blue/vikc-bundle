import { describe, expect, it } from "vitest";
import {
  TAM_CHUC_NIGHTS, addDays, dayRange, daysUntil, deriveStay, headcountByDay, presenceDays,
  progressOf, summarize, vnDate, type TripRow,
} from "../src/index.js";

const row = (over: Partial<TripRow> = {}): TripRow => ({
  memberId: "SKJ-198",
  fullName: "Trương Hứa Dân",
  arrivalAt: null,
  departureAt: null,
  roomType: null,
  ...over,
});

describe("vnDate", () => {
  it("uses the Vietnam calendar, not UTC", () => {
    // 2026-11-17T18:00Z is already 18/11 in Vietnam (UTC+7)
    expect(vnDate("2026-11-17T18:00:00.000Z")).toBe("2026-11-18");
    expect(vnDate("2026-11-17T16:59:00.000Z")).toBe("2026-11-17");
  });
});

describe("deriveStay", () => {
  it("counts nights by check-in day: arrive 18/11, leave 22/11 = 4 nights, 5 days", () => {
    const stay = deriveStay(row({ arrivalAt: "2026-11-18T14:00:00+07:00", departureAt: "2026-11-22T10:00:00+07:00" }));
    expect(stay).toMatchObject({ nights: 4, days: 5, tamChucNights: 4, haNoiNights: 0, outsideNights: 0, warnings: [] });
  });

  it("splits a long stay across both legs (20/11 → 29/11)", () => {
    const stay = deriveStay(row({ arrivalAt: "2026-11-20T09:30:00+07:00", departureAt: "2026-11-29T20:00:00+07:00" }));
    expect(stay.nights).toBe(9);
    expect(stay.tamChucNights).toBe(3); // 20, 21, 22
    expect(stay.haNoiNights).toBe(6); // 23 … 28
    expect(stay.outsideNights).toBe(0);
  });

  it("flags a night outside both legs and a stay outside the tracked window", () => {
    const stay = deriveStay(row({ arrivalAt: "2026-11-15T10:00:00+07:00", departureAt: "2026-11-20T10:00:00+07:00" }));
    expect(stay.nights).toBe(5);
    expect(stay.tamChucNights).toBe(2); // 18, 19
    expect(stay.outsideNights).toBe(3); // 15, 16, 17
    expect(stay.warnings).toContain("outside-window");
    expect(stay.warnings).toContain("nights-outside-legs");
  });

  it("rejects a departure before the arrival", () => {
    const stay = deriveStay(row({ arrivalAt: "2026-11-20T10:00:00+07:00", departureAt: "2026-11-19T10:00:00+07:00" }));
    expect(stay.nights).toBe(0);
    expect(stay.warnings).toEqual(["departure-before-arrival"]);
  });

  it("reports missing datetimes instead of guessing", () => {
    expect(deriveStay(row({ arrivalAt: "2026-11-19T10:00:00+07:00" })).warnings).toEqual(["missing-datetime"]);
    expect(deriveStay(row()).nights).toBe(0);
  });
});

describe("presenceDays", () => {
  it("is arrival day through departure day inclusive (= nights + 1)", () => {
    const days = presenceDays(row({ arrivalAt: "2026-11-18T14:00:00+07:00", departureAt: "2026-11-22T10:00:00+07:00" }));
    expect(days).toEqual(["2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"]);
    expect(days).toHaveLength(deriveStay(row({ arrivalAt: "2026-11-18T14:00:00+07:00", departureAt: "2026-11-22T10:00:00+07:00" })).days);
  });
});

describe("headcountByDay", () => {
  const rows = [
    row({ memberId: "A", arrivalAt: "2026-11-18T14:00:00+07:00", departureAt: "2026-11-22T10:00:00+07:00", roomType: "Đôi" }),
    row({ memberId: "B", arrivalAt: "2026-11-20T09:30:00+07:00", departureAt: "2026-11-29T20:00:00+07:00", roomType: "Ba" }),
    row({ memberId: "C", arrivalAt: "2026-11-21T08:00:00+07:00" }), // no departure yet → present, not confirmed
    row({ memberId: "D" }), // not filled in
  ];

  it("covers the whole window day by day", () => {
    const days = headcountByDay(rows, "2026-11-18", "2026-11-30");
    expect(days).toHaveLength(13);
    // A 18→22 (5 days) · B 20→29 (10 days) · C arrives 21, no departure → present to the end
    expect(days.map((d) => d.present)).toEqual([1, 1, 2, 3, 3, 2, 2, 2, 2, 2, 2, 2, 1]);
    // confirmed = both datetimes known: C is not, so her days drop out of this row
    expect(days.map((d) => d.confirmed)).toEqual([1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 0]);
  });

  it("marks the VIKC and Hà Nội days", () => {
    const days = headcountByDay(rows, "2026-11-18", "2026-11-30");
    expect(days.filter((d) => d.vikcDay).map((d) => d.day)).toEqual([
      "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22",
    ]);
    expect(days.find((d) => d.day === "2026-11-23")?.haNoiDay).toBe(true);
  });
});

describe("progress + summary", () => {
  it("classifies rows and totals the delegation", () => {
    const rows = [
      row({ memberId: "A", arrivalAt: "2026-11-18T14:00:00+07:00", departureAt: "2026-11-22T10:00:00+07:00", roomType: "Đôi" }),
      row({ memberId: "B", arrivalAt: "2026-11-20T09:30:00+07:00" }),
      row({ memberId: "C" }),
    ];
    expect(rows.map(progressOf)).toEqual(["complete", "partial", "missing"]);
    const s = summarize(rows);
    expect(s).toMatchObject({ total: 3, complete: 1, partial: 1, missing: 1, withDatetimes: 1, totalNights: 4 });
    expect(s.avgNights).toBe(4);
  });
});

describe("date helpers", () => {
  it("builds inclusive ranges and counts down to the deadline", () => {
    expect(dayRange("2026-11-18", "2026-11-20")).toEqual(["2026-11-18", "2026-11-19", "2026-11-20"]);
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(daysUntil("2026-10-20", new Date("2026-10-08T12:00:00+07:00"))).toBe(12);
    expect(TAM_CHUC_NIGHTS.to).toBe("2026-11-22");
  });
});
