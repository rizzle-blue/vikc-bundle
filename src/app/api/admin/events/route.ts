import type { NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase-admin";
import { assertAdmin, bad, eventPayload, fail, ok } from "../_helpers";

export async function POST(req: NextRequest) {
  const denied = assertAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const payload = eventPayload(body);
  if (!payload.code || !payload.name_vi) return bad("code và name_vi là bắt buộc");
  const { data, error } = await adminClient().from("events").insert(payload).select("id, code").single();
  if (error) {
    if (/duplicate key/i.test(error.message)) return bad(`Mã sự kiện “${payload.code}” đã tồn tại`, 409);
    return fail(error);
  }
  return ok(data);
}

export async function PATCH(req: NextRequest) {
  const denied = assertAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!Number.isFinite(id)) return bad("id là bắt buộc");
  const payload = eventPayload(body);
  const { code: _code, ...updatable } = payload; // `code` is the stable handle, don't rewrite it
  const { data, error } = await adminClient().from("events").update(updatable).eq("id", id).select("id").single();
  if (error) return fail(error);
  return ok(data);
}

export async function DELETE(req: NextRequest) {
  const denied = assertAdmin(req);
  if (denied) return denied;
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isFinite(id)) return bad("id là bắt buộc");
  const { error } = await adminClient().from("events").delete().eq("id", id);
  if (error) return fail(error);
  return ok();
}
