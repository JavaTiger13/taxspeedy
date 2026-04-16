import { prisma } from "../../../../../lib/prisma";
import { getStorageProvider } from "../../../../../lib/storage";
import fs from "fs/promises";

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const document = await prisma.document.findUnique({ where: { id } });

  if (!document) {
    return new Response("Document not found", { status: 404 });
  }

  const pdfPath = getStorageProvider().absolutePath(document.pdfPath);
  if (!(await fileExists(pdfPath))) {
    return new Response("Original PDF not found", { status: 404 });
  }

  const fileBuffer = await fs.readFile(pdfPath);
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength
  );

  return new Response(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${document.originalName || document.name}.pdf"`,
    },
  });
}
