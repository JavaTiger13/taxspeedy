import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getRoleFromCookies } from "../../../lib/auth";

type SeedDocument = {
  id: string;
  name: string;
  aliasName: string;
  originalName: string;
  type: "BANK" | "INVOICE";
  filePath: string;
  pdfPath: string;
  pageCount: number;
  sortOrder: number;
};

export async function GET(request: Request) {
  if (!getRoleFromCookies(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get("type")?.toUpperCase();
  const validTypes = new Set(["BANK", "INVOICE"]);
  const typeFilter = typeParam && validTypes.has(typeParam) ? (typeParam as "BANK" | "INVOICE") : undefined;

  const documents = await prisma.document.findMany({
    where: typeFilter ? { type: typeFilter } : undefined,
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(documents);
}

export async function PATCH(request: Request) {
  if (getRoleFromCookies(request) !== "Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json();
  const orders = body.orders as { id: string; sortOrder: number }[];

  await prisma.$transaction(
    orders.map(({ id, sortOrder }) =>
      prisma.document.update({ where: { id }, data: { sortOrder } })
    )
  );

  return NextResponse.json({ ok: true });
}
