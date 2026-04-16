import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getRoleFromCookies } from "../../../../lib/auth";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (getRoleFromCookies(request) !== "Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const updates = await request.json();

  const annotation = await prisma.annotation.update({
    where: { id },
    data: updates,
  });

  return NextResponse.json(annotation);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (getRoleFromCookies(request) !== "Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  await prisma.annotation.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
