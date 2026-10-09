"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, MEMBER_COOKIE, cookieOptions, isAdminCode, isMemberCode } from "@/lib/auth";

export type LoginState = { error?: string } | null;

function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === "string" ? next : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

/** Sets the httpOnly cookie for whichever shared code was entered. */
export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const code = String(formData.get("code") ?? "").trim();
  const next = safeNext(formData.get("next"));
  const jar = await cookies();

  if (isAdminCode(code)) {
    jar.set(ADMIN_COOKIE, code, cookieOptions);
  } else if (isMemberCode(code)) {
    jar.set(MEMBER_COOKIE, code, cookieOptions);
  } else {
    return { error: "Mã không đúng. Thử lại hoặc hỏi ban tổ chức." };
  }
  redirect(next);
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(MEMBER_COOKIE);
  jar.delete(ADMIN_COOKIE);
  redirect("/login");
}
