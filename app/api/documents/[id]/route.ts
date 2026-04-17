import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getStorageProvider } from "../../../../lib/storage";
import path from "path";
import { getRoleFromCookies } from "../../../../lib/auth";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (getRoleFromCookies(request) !== "Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
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

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (getRoleFromCookies(_request) !== "Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const document = await prisma.document.findUnique({ where: { id } });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (document.type === "INVOICE") {
    return NextResponse.json({ error: "Document Invoice can not be deleted" }, { status: 404 });
  }

  const storageDir = path.dirname(document.pdfPath);
  console.log("Deleting storage folder for document", id, storageDir);

  try {
    await getStorageProvider().delete(storageDir);
    console.log("Storage folder deleted", storageDir);
  } catch (error) {
    console.error("Failed to delete storage folder", storageDir, error);
  }

  console.log("Deleting annotations for document", id);
  await prisma.annotation.deleteMany({ where: { documentId: id } });

  console.log("Deleting document record", id);
  await prisma.document.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
