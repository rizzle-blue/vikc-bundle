import { describe, expect, it } from "vitest";
import { EXAM_GRADES, VKF_REQUIRED_PROFILE_FIELDS, checkEligibility, missingProfileFields, parseDate } from "../src/lib/registration/index.js";

const EXAM_DAY = "2026-11-20";

describe("Kyu/Dan eligibility (VKF doc 05)", () => {
  it("1 kyu has no age or training-period requirement", () => {
    const e = checkEligibility({ dateOfBirth: "01/01/2015", gradeApplied: "1 kyu", currentRankIssuedOn: null }, EXAM_DAY);
    expect(e.warnings).toEqual([]);
    expect(e.ok).toBe(true);
    expect(e.age).toBe(11);
  });

  it("1 dan needs 13 years", () => {
    expect(checkEligibility({ dateOfBirth: "01/01/2014", gradeApplied: "1 dan" }, EXAM_DAY).warnings).toEqual([
      "VKF yêu cầu tối thiểu 13 tuổi cho 1 dan (hiện 12).",
    ]);
    expect(checkEligibility({ dateOfBirth: "01/01/2013", gradeApplied: "1 dan" }, EXAM_DAY).ok).toBe(true);
  });

  it("2 dan needs 1 year after 1 dan and 14 years of age", () => {
    const justEnough = checkEligibility(
      { dateOfBirth: "01/01/2000", gradeApplied: "2 dan", currentRankIssuedOn: "01/11/2025" }, EXAM_DAY);
    expect(justEnough.ok).toBe(true);
    expect(justEnough.yearsSinceCurrent).toBe(1.1); // 2025-11-01 → 2026-11-20

    const tooEarly = checkEligibility(
      { dateOfBirth: "01/01/2000", gradeApplied: "2 dan", currentRankIssuedOn: "01/06/2026" }, EXAM_DAY);
    expect(tooEarly.ok).toBe(false);
    expect(tooEarly.warnings[0]).toMatch(/tối thiểu 1 năm kể từ khi đạt 1 dan/);
  });

  it("3–5 dan: 2, 3 and 4 years after the previous grade, with ages 16/19/23", () => {
    const cases = [
      { grade: "3 dan", previous: "2 dan", years: 2, age: 16, born: "01/01/2010", issued: "01/01/2024" },
      { grade: "4 dan", previous: "3 dan", years: 3, age: 19, born: "01/01/2005", issued: "01/01/2023" },
      { grade: "5 dan", previous: "4 dan", years: 4, age: 23, born: "01/01/2000", issued: "01/01/2022" },
    ] as const;
    for (const c of cases) {
      const ok = checkEligibility({ dateOfBirth: c.born, gradeApplied: c.grade, currentRankIssuedOn: c.issued }, EXAM_DAY);
      expect(ok.ok, `${c.grade} should pass`).toBe(true);
      const tooSoon = checkEligibility(
        { dateOfBirth: c.born, gradeApplied: c.grade, currentRankIssuedOn: "01/01/2026" }, EXAM_DAY);
      expect(tooSoon.warnings[0]).toContain(`tối thiểu ${c.years} năm kể từ khi đạt ${c.previous}`);
    }
  });

  it("asks for the current certificate's date when the grade needs a training period", () => {
    const e = checkEligibility({ dateOfBirth: "01/01/1990", gradeApplied: "3 dan" }, EXAM_DAY);
    expect(e.warnings.some((w) => w.includes("Cần ngày cấp bằng 2 dan"))).toBe(true);
  });

  it("flags a foreign candidate registering for 1 kyu without a VKF 2 kyu certificate", () => {
    const e = checkEligibility({ gradeApplied: "1 kyu", vkfMember: false }, EXAM_DAY);
    expect(e.warnings[0]).toMatch(/không cần bằng 2 Kyu của VKF/);
  });

  it("keeps the grade list and the required paperwork list in step with VKF", () => {
    expect(EXAM_GRADES).toEqual(["1 kyu", "1 dan", "2 dan", "3 dan", "4 dan", "5 dan"]);
    expect(VKF_REQUIRED_PROFILE_FIELDS).toContain("current_rank_photo_url");
    expect(VKF_REQUIRED_PROFILE_FIELDS).toHaveLength(8);
  });
});

describe("date + paperwork helpers", () => {
  it("parses the roster's dd/mm/yyyy and ISO dates", () => {
    expect(parseDate("02/06/1994")?.toISOString().slice(0, 10)).toBe("1994-06-02");
    expect(parseDate("1994-06-02")?.toISOString().slice(0, 10)).toBe("1994-06-02");
    expect(parseDate("not a date")).toBeNull();
    expect(parseDate(null)).toBeNull();
  });

  it("reports which VKF fields are still empty", () => {
    const empty = missingProfileFields(null);
    expect(empty).toHaveLength(8);
    const filled = Object.fromEntries(VKF_REQUIRED_PROFILE_FIELDS.map((f) => [f, "x"]));
    expect(missingProfileFields(filled)).toEqual([]);
    expect(missingProfileFields({ ...filled, national_id: "  " })).toEqual(["national_id"]);
  });
});
