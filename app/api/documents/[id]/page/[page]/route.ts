import { prisma } from "../../../../../../lib/prisma";
import { getStorageProvider } from "../../../../../../lib/storage";
import fs from "fs/promises";
import path from "path";

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; page: string }> }) {
  const { id, page } = await params;
  const pageNumber = Number(page);

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) {
    return new Response("Document not found", { status: 404 });
  }

  if (!pageNumber || pageNumber < 1 || pageNumber > document.pageCount) {
    return new Response("Page not found", { status: 404 });
  }

  const pdfAbsolute = getStorageProvider().absolutePath(document.pdfPath);
  const pageImagePath = path.join(path.dirname(pdfAbsolute), `page-${pageNumber}.png`);

  if (await fileExists(pageImagePath)) {
    const imageBuffer = await fs.readFile(pageImagePath);
    return new Response(imageBuffer, {
      status: 200,
      headers: { "Content-Type": "image/png" },
    });
  }

  const fallbackPath = path.join(process.cwd(), "public", "mock-pages", `${id}-page-${pageNumber}.png`);
  if (await fileExists(fallbackPath)) {
    const imageBuffer = await fs.readFile(fallbackPath);
    return new Response(imageBuffer, {
      status: 200,
      headers: { "Content-Type": "image/png" },
    });
  }

  return new Response("Page image not found", { status: 404 });
}
