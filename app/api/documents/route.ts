import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

type SeedDocument = {
  id: string;
  name: string;
  aliasName: string;
  originalName: string;
  type: "BANK" | "INVOICE";
  filePath: string;
  pdfPath: string;
  pageCount: number;
  sortOrder: number;
};

const initialDocuments: SeedDocument[] = [
  {
    id: "bank-january-2024",
    name: "January 2024",
    aliasName: "January 2024",
    originalName: "January 2024",
    type: "BANK",
    filePath: "/documents/january-2024.pdf",
    pdfPath: "public/documents/january-2024.pdf",
    pageCount: 3,
    sortOrder: 1,
  },
  {
    id: "bank-february-2024",
    name: "February 2024",
    aliasName: "February 2024",
    originalName: "February 2024",
    type: "BANK",
    filePath: "/documents/february-2024.pdf",
    pdfPath: "public/documents/february-2024.pdf",
    pageCount: 2,
    sortOrder: 2,
  },
  {
    id: "invoice-amazon-2024",
    name: "Amazon Invoice",
    aliasName: "Amazon Invoice",
    originalName: "Amazon Invoice",
    type: "INVOICE",
    filePath: "/documents/amazon-invoice.pdf",
    pdfPath: "public/documents/amazon-invoice.pdf",
    pageCount: 1,
    sortOrder: 3,
  },
  {
    id: "invoice-telekom-2024",
    name: "Telekom Invoice",
    aliasName: "Telekom Invoice",
    originalName: "Telekom Invoice",
    type: "INVOICE",
    filePath: "/documents/telekom-invoice.pdf",
    pdfPath: "public/documents/telekom-invoice.pdf",
    pageCount: 1,
    sortOrder: 4,
  },
];

export async function GET(request: Request) {
  const count = await prisma.document.count();

  if (count === 0) {
    await prisma.document.createMany({
      data: initialDocuments,
    });
  }

  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get("type")?.toUpperCase();
  const validTypes = new Set(["BANK", "INVOICE"]);
  const typeFilter = typeParam && validTypes.has(typeParam) ? (typeParam as "BANK" | "INVOICE") : undefined;

  const documents = await prisma.document.findMany({
    where: typeFilter ? { type: typeFilter } : undefined,
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(documents);
}
