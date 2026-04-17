import { prisma } from "../../../../../../lib/prisma";
import { getStorageProvider } from "../../../../../../lib/storage";

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

  try {
    const storage = getStorageProvider();

    // derive path from PDF path
    // e.g. documents/abc123/original.pdf => documents/abc123/page-1.png
    const basePath = document.pdfPath.replace(/\/[^\/]+$/, "");
    const pagePath = `${basePath}/page-${pageNumber}.png`;

    const imageBuffer = await storage.getFile(pagePath);

    return new Response(new Uint8Array(imageBuffer), {
      status: 200,
      headers: { "Content-Type": "image/png" },
    });
  } catch (error) {
    console.error(error);
    return new Response("Page image not found", { status: 404 });
  }
}
