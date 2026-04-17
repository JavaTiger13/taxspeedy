import { prisma } from "../../../../../lib/prisma";
import { getStorageProvider } from "../../../../../lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const document = await prisma.document.findUnique({ where: { id } });

  if (!document) {
    return new Response("Document not found", { status: 404 });
  }

  try {
    const fileBuffer = await getStorageProvider().getFile(document.pdfPath);

    return new Response(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${document.originalName || document.name}.pdf"`,
      },
    });
  } catch (error) {
    console.error(error);

    return new Response("Original PDF not found", { status: 404 });
  }
}
