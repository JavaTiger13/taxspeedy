import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const documentId = url.searchParams.get("documentId");
  const page = Number(url.searchParams.get("page") || "1");

  if (!documentId) {
    return NextResponse.json([], { status: 400 });
  }

  const annotations = await prisma.annotation.findMany({
    where: {
      documentId,
      page,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return NextResponse.json(annotations);
}

export async function POST(request: Request) {
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
