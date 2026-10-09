import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, MEMBER_COOKIE, isAdminCode, isMemberCode } from "@/lib/auth";

/**
 * Gate the two areas: `/enroll` needs the member code (or the admin one), `/admin` + `/api/admin`
 * need the admin code. The codes come from server env and are compared here, in the middleware —
 * the browser only ever holds an httpOnly cookie.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const admin = isAdminCode(req.cookies.get(ADMIN_COOKIE)?.value);
  const member = admin || isMemberCode(req.cookies.get(MEMBER_COOKIE)?.value);

  const needsAdmin = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  const needsMember = pathname.startsWith("/enroll");
  if ((needsAdmin && !admin) || (needsMember && !member)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/enroll/:path*", "/admin/:path*", "/api/admin/:path*"] };
