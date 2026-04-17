import { NextResponse } from "next/server";
import { cookieOptions, signedCookieValue } from "../../../lib/auth";
import type { Role } from "../../../lib/auth";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { role, password } = body as { role?: unknown; password?: unknown };

  if (role !== "Admin" && role !== "Viewer") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const expected =
    role === "Admin"
      ? process.env.ADMIN_PASSWORD
      : process.env.VIEWER_PASSWORD;

  if (!expected || password !== expected) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({ ...cookieOptions(), value: signedCookieValue(role as Role) });
  return response;
}
