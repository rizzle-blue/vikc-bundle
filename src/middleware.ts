import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, MEMBER_COOKIE, isAdminCode, isMemberCode } from "@/lib/auth";

/**
 * The two shared access codes (owner decision D9).
 *
 *   member code → /enroll                     (members: their own trip + event check-ins)
 *   admin code  → everything else with data   (board, roster, registration rows, the operator area
 *                                              and its write routes)
 *
 * The codes come from server env and are compared here, so the browser only ever holds an httpOnly
 * cookie. This is a private-link gate, not accounts — operator writes additionally require the
 * service key (src/app/api/admin/*), so the member code cannot change the programme.
 */
const ADMIN_AREAS = ["/admin", "/api/admin", "/track", "/members", "/trips", "/stay"];
const MEMBER_AREAS = ["/enroll"];

const inArea = (pathname: string, areas: string[]) =>
  areas.some((area) => pathname === area || pathname.startsWith(`${area}/`));

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const admin = isAdminCode(req.cookies.get(ADMIN_COOKIE)?.value);
  const member = admin || isMemberCode(req.cookies.get(MEMBER_COOKIE)?.value);

  const needsAdmin = inArea(pathname, ADMIN_AREAS);
  const needsMember = inArea(pathname, MEMBER_AREAS);
  if ((needsAdmin && !admin) || (needsMember && !member)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/enroll/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
    "/track/:path*",
    "/members/:path*",
    "/trips/:path*",
    "/stay/:path*",
  ],
};
