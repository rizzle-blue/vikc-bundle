import type { NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase-admin";
import { assertAdmin, bad, fail } from "../_helpers";

const cell = (v: unknown) => {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV for the organisers: one row per member × event (optionally one event), plus a summary. */
export async function GET(req: NextRequest) {
  const denied = assertAdmin(req);
  if (denied) return denied;
  const params = new URL(req.url).searchParams;
  const code = params.get("event");
  const kind = params.get("kind"); // "signups" (default) | "counts" | "members"

  const db = adminClient();
  let headers: string[] = [];
  let rows: unknown[][] = [];
  let filename = "vikc";

  if (kind === "counts") {
    const { data, error } = await db
      .from("v_event_signup_counts")
      .select("code, name_vi, kind, starts_at, counts_as_entry, included_in_package, price_vnd, capacity, signups, confirmed")
      .order("sort_order");
    if (error) return fail(error);
    headers = ["code", "name_vi", "kind", "starts_at", "counts_as_entry", "included_in_package", "price_vnd", "capacity", "signups", "confirmed"];
    rows = (data ?? []).map((r) => headers.map((h) => (r as Record<string, unknown>)[h]));
    filename = "vikc-events";
  } else if (kind === "vkf") {
    // VKF's own workbook columns, in their order (resources/vikc-2026/data/09-mau-dang-ky.csv)
    const { data, error } = await db.from("v_vikc_registration").select("*").order("full_name");
    if (error) return fail(error);
    const rowsData = data ?? [];
    headers = ["STT", "Họ và tên", "Giới tính", "Ngày", "Tháng", "Năm", "Số CCCD", "Số điện thoại", "Email",
      "Liên hệ khẩn cấp", "Thành viên VKF", "Mã số VKF", "Trình độ hiện tại", "Ngày cấp bằng hiện có",
      "Nơi/đơn vị cấp bằng", "Link ảnh bằng", "1 Kyu", "Dan", "Vai trò", "Số đêm Tam Chúc", "Số đêm Hà Nội",
      "Loại phòng", "Ở cùng ai", "Số nội dung thi đấu", "Còn thiếu (mục)"];
    const dob = (v: string | null) => (v ? v.split("-") : ["", "", ""]);
    rows = rowsData.map((r, i) => {
      const [y, m, d] = dob(r.date_of_birth as string | null);
      const grade = (r.grade_applied as string | null) ?? "";
      return [
        i + 1, r.full_name, r.gender, d, m, y, r.national_id, r.phone, r.email, r.emergency_contact,
        r.vkf_member ? "Có" : "Không", r.vkf_id, r.current_rank, r.current_rank_issued_on,
        r.current_rank_issued_by, r.current_rank_photo_url,
        grade === "1 kyu" ? "X" : "", grade && grade !== "1 kyu" ? grade : "",
        r.role === "competitor" ? "VĐV" : (r.role ?? ""),
        r.tam_chuc_nights, r.ha_noi_nights, r.room_type, r.roommate, r.entries, r.missing_fields,
      ];
    });
    filename = "vikc-registration";
  } else if (kind === "members") {
    const { data, error } = await db
      .from("v_member_stay")
      .select("member_id, full_name, expected, role, arrival_at, departure_at, nights, days, tam_chuc_nights, ha_noi_nights, room_type, roommate, complete")
      .order("full_name");
    if (error) return fail(error);
    headers = ["member_id", "full_name", "expected", "role", "arrival_at", "departure_at", "nights", "days", "tam_chuc_nights", "ha_noi_nights", "room_type", "roommate", "complete"];
    rows = (data ?? []).map((r) => headers.map((h) => (r as Record<string, unknown>)[h]));
    filename = "vikc-members";
  } else {
    let query = db
      .from("v_member_signups")
      .select("member_id, full_name, code, name_vi, kind, starts_at, session_title, session_starts_at, status, answers, updated_at")
      .order("code");
    if (code) query = query.eq("code", code);
    const { data, error } = await query;
    if (error) return fail(error);
    if (!data?.length && code) return bad(`không có đăng ký nào cho ${code}`, 404);
    headers = ["member_id", "full_name", "code", "name_vi", "kind", "starts_at", "session_title", "session_starts_at", "status", "answers", "updated_at"];
    rows = (data ?? []).map((r) => headers.map((h) => (r as Record<string, unknown>)[h]));
    filename = code ? `vikc-${code}` : "vikc-signups";
  }

  const csv = [headers.join(","), ...rows.map((r) => r.map(cell).join(","))].join("\n");
  return new Response(`\uFEFF${csv}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}
