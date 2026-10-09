import type { NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase-admin";
import { assertAdmin, bad, fail, ok } from "../_helpers";

/** Operator marks the members they know are coming (`expected`). It is not a denominator. */
export async function PATCH(req: NextRequest) {
  const denied = assertAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.map(String) : body.id ? [String(body.id)] : [];
  if (!ids.length) return bad("id hoặc ids là bắt buộc");
  const { error } = await adminClient().from("members").update({ expected: body.expected === true }).in("id", ids);
  if (error) return fail(error);
  return ok({ updated: ids.length });
}
