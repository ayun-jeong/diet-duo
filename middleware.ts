import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Capacitor iOS: capacitor://localhost
// Capacitor Android: http://localhost
const ALLOWED_ORIGINS = [
  "https://diet-duo.vercel.app",
  "capacitor://localhost",
  "http://localhost",
];

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin);

  // Preflight
  if (request.method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 });
    if (allowed) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Access-Control-Allow-Credentials", "true");
      res.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      res.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
      );
      res.headers.set("Access-Control-Max-Age", "86400");
    }
    return res;
  }

  const response = NextResponse.next();
  if (allowed) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
