import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getRoleFromCookies } from "../../../lib/auth";

export async function GET(request: Request) {
  if (!getRoleFromCookies(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const documentId = url.searchParams.get("documentId");
  const pageParam = url.searchParams.get("page");
  const page = pageParam ? Number(pageParam) : undefined;

  const where: { documentId?: string; page?: number } = {};

  if (documentId) {
    where.documentId = documentId;
  }

  if (page !== undefined && !Number.isNaN(page)) {
    where.page = page;
  }

  const annotations = await prisma.annotation.findMany({
    where,
    orderBy: {
      createdAt: "asc",
    },
  });

  return NextResponse.json(annotations);
}

export async function POST(request: Request) {
  if (getRoleFromCookies(request) !== "Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const data = await request.json();
  const { documentId, page, x, y, width, height, type, category, comment, linkedDocumentId } = data;

  if (!documentId || !page || x == null || y == null || width == null || height == null || !type) {
    return NextResponse.json({ error: "Missing required annotation data" }, { status: 400 });
  }

  const annotation = await prisma.annotation.create({
    data: {
      documentId,
      page,
      x,
      y,
      width,
      height,
      type,
      category,
      comment,
      linkedDocumentId,
    },
  });

  return NextResponse.json(annotation);
}
