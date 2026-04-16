export type Role = "Admin" | "Viewer";

const COOKIE_NAME = "role";

export function getRoleFromCookies(request: Request): Role | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)role=([^;]+)/);
  if (!match) return null;
  const value = decodeURIComponent(match[1]);
  if (value === "Admin" || value === "Viewer") return value;
  return null;
}

export function cookieOptions(maxAge?: number) {
  const isProd = process.env.NODE_ENV === "production";
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd,
    path: "/",
    ...(maxAge !== undefined ? { maxAge } : {}),
  };
}
