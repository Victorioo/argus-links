import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isPublic =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/api/password/") ||
    pathname === "/verify-email" ||
    // MCP / OAuth for connecting Claude: called by the connector, not a browser session
    pathname.startsWith("/.well-known/") ||
    pathname === "/api/mcp" ||
    pathname === "/api/oauth/token" ||
    pathname === "/api/oauth/register" ||
    pathname.startsWith("/api/verify/") ||
    pathname === "/comment-overlay.js" ||
    pathname.startsWith("/r/") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/register") ||
    pathname.startsWith("/api/comments");

  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    // Keep the query string: /oauth/authorize?… must survive the login round trip.
    loginUrl.searchParams.set("from", pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
