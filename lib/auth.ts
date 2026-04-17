import { createHmac, timingSafeEqual } from "crypto";

export type Role = "Admin" | "Viewer";

const COOKIE_NAME = "auth";

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET environment variable is not set.");
  return secret;
}

function sign(role: Role): string {
  const sig = createHmac("sha256", getSecret()).update(role).digest("hex");
  return `${role}.${sig}`;
}

function verify(value: string): Role | null {
  const dotIndex = value.indexOf(".");
  if (dotIndex === -1) return null;

  const role = value.slice(0, dotIndex);
  const sig = value.slice(dotIndex + 1);

  if (role !== "Admin" && role !== "Viewer") return null;

  const expected = createHmac("sha256", getSecret()).update(role).digest("hex");
  try {
    const sigBuf = Buffer.from(sig, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;
  } catch {
    return null;
  }

  return role as Role;
}

export function getRoleFromCookies(request: Request): Role | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)auth=([^;]+)/);
  if (!match) return null;
  return verify(decodeURIComponent(match[1]));
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

export function signedCookieValue(role: Role): string {
  return sign(role);
}

/** Read and verify the signed "auth" cookie from the Next.js cookies() store (server components). */
export function verifySignedValue(value: string): Role | null {
  return verify(value);
}
