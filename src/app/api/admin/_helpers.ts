import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isAdminCode } from "@/lib/auth";

/** Defence in depth: the middleware already gates /api/admin/*, this re-checks the cookie. */
export function assertAdmin(req: NextRequest): NextResponse | null {
  if (!isAdminCode(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "admin code required" }, { status: 403 });
  }
  return null;
}

export const ok = (data?: unknown) => NextResponse.json({ ok: true, data: data ?? null });
export const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
export const fail = (error: { message: string }) => NextResponse.json({ error: error.message }, { status: 500 });

const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const num = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};
const bool = (v: unknown) => v === true || v === "true";
const json = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  return v;
};

/** Whitelist + coerce what the operator form may write. */
export function eventPayload(body: Record<string, unknown>) {
  return {
    code: str(body.code),
    name_vi: str(body.name_vi),
    name_en: str(body.name_en),
    kind: str(body.kind) ?? "other",
    starts_at: str(body.starts_at),
    ends_at: str(body.ends_at),
    venue: str(body.venue),
    counts_as_entry: bool(body.counts_as_entry),
    included_in_package: bool(body.included_in_package),
    price_vnd: num(body.price_vnd),
    capacity: num(body.capacity),
    signup_opens_at: str(body.signup_opens_at),
    signup_closes_at: str(body.signup_closes_at),
    requires_team: bool(body.requires_team),
    team_size: num(body.team_size),
    team_gender: str(body.team_gender),
    form_schema: json(body.form_schema),
    sort_order: num(body.sort_order) ?? 0,
    active: body.active === undefined ? true : bool(body.active),
    notes: str(body.notes),
    updated_at: new Date().toISOString(),
  };
}
