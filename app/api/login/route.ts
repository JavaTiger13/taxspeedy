import { NextResponse } from "next/server";
import { cookieOptions } from "../../../lib/auth";

export async function POST(request: Request) {
  const { role, password } = await request.json();

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

  const response = NextResponse.json({ role });
  response.cookies.set({ ...cookieOptions(), value: role });
  return response;
}
