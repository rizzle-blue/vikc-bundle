/**
 * Kyu/Dan exam eligibility, straight from VKF's doc 05
 * (resources/vikc-2026/md/05-thi-kyu-dan-va-mau-dang-ky.md).
 *
 * The app only *warns*: VKF is the authority, and a candidate may have a case the table cannot
 * express (e.g. a foreign candidate registering for 1 Kyu without a VKF 2 Kyu certificate).
 */
export const EXAM_GRADES = ["1 kyu", "1 dan", "2 dan", "3 dan", "4 dan", "5 dan"] as const;
export type ExamGrade = (typeof EXAM_GRADES)[number];

/** Minimum age and minimum time since the previous grade, per grade applied for. */
const RULES: Record<ExamGrade, { minAge: number | null; yearsAfterPrevious: number | null; previous: string | null }> = {
  "1 kyu": { minAge: null, yearsAfterPrevious: null, previous: null },
  "1 dan": { minAge: 13, yearsAfterPrevious: null, previous: "1 kyu" },
  "2 dan": { minAge: 14, yearsAfterPrevious: 1, previous: "1 dan" },
  "3 dan": { minAge: 16, yearsAfterPrevious: 2, previous: "2 dan" },
  "4 dan": { minAge: 19, yearsAfterPrevious: 3, previous: "3 dan" },
  "5 dan": { minAge: 23, yearsAfterPrevious: 4, previous: "4 dan" },
};

export interface EligibilityInput {
  dateOfBirth?: string | null;        // from the roster (dd/mm/yyyy or yyyy-mm-dd)
  currentRank?: string | null;
  currentRankIssuedOn?: string | null; // date the current grade's certificate was issued
  gradeApplied?: string | null;
  examDate?: string | null;            // default: the exam day
  vkfMember?: boolean | null;
}

export interface Eligibility {
  grade: string;
  minAge: number | null;
  yearsAfterPrevious: number | null;
  age: number | null;
  yearsSinceCurrent: number | null;
  warnings: string[];
  ok: boolean;
}

/** Accepts both `dd/mm/yyyy` (the roster's format) and ISO dates. */
export function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (dmy) return new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])));
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const yearsBetween = (from: Date, to: Date) => (to.getTime() - from.getTime()) / (365.2425 * 86_400_000);

export function checkEligibility(input: EligibilityInput, examDate = "2026-11-20"): Eligibility {
  const grade = (input.gradeApplied ?? "") as ExamGrade;
  const rule = RULES[grade];
  const exam = parseDate(input.examDate ?? examDate)!;
  const dob = parseDate(input.dateOfBirth);
  const issued = parseDate(input.currentRankIssuedOn);
  const age = dob ? Math.floor(yearsBetween(dob, exam)) : null;
  const yearsSinceCurrent = issued ? yearsBetween(issued, exam) : null;
  const warnings: string[] = [];

  if (!rule) {
    return { grade, minAge: null, yearsAfterPrevious: null, age, yearsSinceCurrent, warnings, ok: false };
  }
  if (rule.minAge !== null && age !== null && age < rule.minAge) {
    warnings.push(`VKF yêu cầu tối thiểu ${rule.minAge} tuổi cho ${grade} (hiện ${age}).`);
  }
  if (rule.yearsAfterPrevious !== null && yearsSinceCurrent !== null && yearsSinceCurrent + 0.02 < rule.yearsAfterPrevious) {
    warnings.push(
      `Cần tối thiểu ${rule.yearsAfterPrevious} năm kể từ khi đạt ${rule.previous} — mới ${yearsSinceCurrent.toFixed(1)} năm.`,
    );
  }
  if (rule.yearsAfterPrevious !== null && !input.currentRankIssuedOn) {
    warnings.push(`Cần ngày cấp bằng ${rule.previous} để VKF xét thời gian tập luyện tối thiểu.`);
  }
  if (rule.yearsAfterPrevious !== null && input.currentRankIssuedOn && yearsSinceCurrent === null) {
    warnings.push("Ngày cấp bằng hiện có không đọc được — kiểm tra lại định dạng.");
  }
  if (grade === "1 kyu" && input.vkfMember === false) {
    warnings.push("Thí sinh nước ngoài không cần bằng 2 Kyu của VKF cho kỳ thi 1 Kyu.");
  }
  return {
    grade,
    minAge: rule.minAge,
    yearsAfterPrevious: rule.yearsAfterPrevious,
    age,
    yearsSinceCurrent: yearsSinceCurrent === null ? null : Math.round(yearsSinceCurrent * 10) / 10,
    warnings,
    ok: warnings.length === 0,
  };
}

/** Fields VKF's workbook wants that we cannot get from the roster. */
export const VKF_REQUIRED_PROFILE_FIELDS = [
  "full_name_latin",
  "national_id",
  "address",
  "occupation",
  "emergency_contact",
  "current_rank_issued_on",
  "current_rank_issued_by",
  "current_rank_photo_url",
] as const;

export function missingProfileFields(profile: Record<string, unknown> | null | undefined): string[] {
  if (!profile) return [...VKF_REQUIRED_PROFILE_FIELDS];
  return VKF_REQUIRED_PROFILE_FIELDS.filter((f) => {
    const v = profile[f];
    return v === null || v === undefined || String(v).trim() === "";
  });
}
