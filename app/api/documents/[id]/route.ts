import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const aliasName = body?.aliasName?.trim();

  if (!aliasName) {
    return NextResponse.json({ error: "aliasName is required" }, { status: 400 });
  }

  const updated = await prisma.document.update({
    where: { id },
    data: { aliasName },
  });

  return NextResponse.json(updated);
}
