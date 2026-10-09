import type { NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase-admin";
import { assertAdmin, bad, fail, ok } from "../_helpers";

const payload = (b: Record<string, unknown>) => ({
  event_id: Number(b.event_id),
  starts_at: typeof b.starts_at === "string" ? b.starts_at : null,
  ends_at: typeof b.ends_at === "string" && b.ends_at !== "" ? b.ends_at : null,
  title: typeof b.title === "string" && b.title.trim() !== "" ? b.title.trim() : null,
  venue: typeof b.venue === "string" && b.venue.trim() !== "" ? b.venue.trim() : null,
  notes: typeof b.notes === "string" && b.notes.trim() !== "" ? b.notes.trim() : null,
});

export async function POST(req: NextRequest) {
  const denied = assertAdmin(req);
  if (denied) return denied;
  const p = payload(await req.json().catch(() => ({})));
  if (!Number.isFinite(p.event_id) || !p.starts_at) return bad("event_id và starts_at là bắt buộc");
  const { data, error } = await adminClient().from("event_sessions").insert(p).select("id").single();
  if (error) return fail(error);
  return ok(data);
}

export async function PATCH(req: NextRequest) {
  const denied = assertAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!Number.isFinite(id)) return bad("id là bắt buộc");
  const p = payload(body);
  const { event_id: _eventId, ...updatable } = p;
  const { error } = await adminClient().from("event_sessions").update(updatable).eq("id", id);
  if (error) return fail(error);
  return ok();
}

export async function DELETE(req: NextRequest) {
  const denied = assertAdmin(req);
  if (denied) return denied;
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isFinite(id)) return bad("id là bắt buộc");
  const { error } = await adminClient().from("event_sessions").delete().eq("id", id);
  if (error) return fail(error);
  return ok();
}
