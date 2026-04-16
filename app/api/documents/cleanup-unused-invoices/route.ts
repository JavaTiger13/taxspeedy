import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import fs from "fs/promises";
import path from "path";
import { getRoleFromCookies } from "../../../../lib/auth";

export async function DELETE(request: Request) {
  if (getRoleFromCookies(request) !== "Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Collect all invoice IDs currently linked by an annotation's linkedDocumentId
  const linkedAnnotations = await prisma.annotation.findMany({
    where: { linkedDocumentId: { not: null } },
    select: { linkedDocumentId: true },
  });
  const linkedIds: string[] = linkedAnnotations
    .map((a: { linkedDocumentId: string | null }) => a.linkedDocumentId)
    .filter((id: string | null): id is string => id !== null);

  // Find INVOICE documents whose ID does not appear as any annotation's linkedDocumentId
  const unusedInvoices = await prisma.document.findMany({
    where: {
      type: "INVOICE",
      id: { notIn: linkedIds },
    },
    select: { id: true },
  });

  const ids: string[] = unusedInvoices.map((d: { id: string }) => d.id);
  console.log("Unused invoices to delete:", ids);

  for (const id of ids) {
    const storagePath = path.join(process.cwd(), "storage", "documents", id);
    try {
      await fs.rm(storagePath, { recursive: true, force: true });
      console.log("Deleted storage for invoice", id);
    } catch (error) {
      console.error("Failed to delete storage for invoice", id, error);
    }
  }

  const { count } = await prisma.document.deleteMany({
    where: { id: { in: ids } },
  });

  return NextResponse.json({ deleted: count });
}
