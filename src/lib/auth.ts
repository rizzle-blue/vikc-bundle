/**
 * Two shared access codes (owner decision D9): one for members, one for the operator.
 * Deliberately simple — a UI gate, not accounts. The cookie holds the code itself, httpOnly, so it
 * never reaches client JavaScript. Admin writes additionally go through a server route that holds
 * the service key, so knowing the member code can never edit the programme.
 */
export const MEMBER_COOKIE = "vikc_member";
export const ADMIN_COOKIE = "vikc_admin";

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 60, // 60 days
  secure: process.env.NODE_ENV === "production",
};

export function isAdminCode(code: string | undefined | null): boolean {
  const expected = process.env.ADMIN_ACCESS_CODE;
  return Boolean(expected) && code === expected;
}

export function isMemberCode(code: string | undefined | null): boolean {
  const expected = process.env.MEMBER_ACCESS_CODE;
  return Boolean(expected) && code === expected;
}
