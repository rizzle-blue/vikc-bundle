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
  } else if (kind === "members") {
    const { data, error } = await db
      .from("v_member_stay")
      .select("member_id, full_name, expected, role, arrival_at, departure_at, nights, days, tam_chuc_nights, ha_noi_nights, room_type, roommate, exam_grade, complete")
      .order("full_name");
    if (error) return fail(error);
    headers = ["member_id", "full_name", "expected", "role", "arrival_at", "departure_at", "nights", "days", "tam_chuc_nights", "ha_noi_nights", "room_type", "roommate", "exam_grade", "complete"];
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
