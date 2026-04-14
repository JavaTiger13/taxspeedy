import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { spawn, spawnSync } from "child_process";

type UploadedDocument = {
  id: string;
  name: string;
  originalName: string;
  type: "BANK" | "INVOICE";
  filePath: string;
  pdfPath: string;
  pageCount: number;
  sortOrder: number;
};

async function saveFile(file: File, destination: string) {
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(destination, buffer);
}

function ensurePdftoppmInstalled() {
  const result = spawnSync("pdftoppm", ["-v"]);
  const error = result.error as NodeJS.ErrnoException | undefined;

  if (error?.code === "ENOENT") {
    throw new Error(
      "The system tool pdftoppm is not installed. Install Poppler on macOS with: brew install poppler"
    );
  }
}

async function convertPdfToPng(pdfPath: string, outputDir: string) {
  return new Promise<void>((resolve, reject) => {
    const outPrefix = path.join(outputDir, "page");
    const converter = spawn("pdftoppm", ["-png", pdfPath, outPrefix], {
      stdio: ["ignore", "inherit", "inherit"],
    });

    converter.on("error", (error) => {
      reject(error);
    });

    converter.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`pdftoppm exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const files = formData.getAll("files");

  if (!files.length) {
    return NextResponse.json({ error: "No files uploaded." }, { status: 400 });
  }

  try {
    ensurePdftoppmInstalled();
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }

  const maxOrder = await prisma.document.aggregate({ _max: { sortOrder: true } });
  let sortOrder = (maxOrder._max.sortOrder ?? 0) + 1;
  const createdDocuments: UploadedDocument[] = [];

  for (const rawFile of files) {
    if (!rawFile || typeof rawFile !== "object" || typeof (rawFile as File).arrayBuffer !== "function") {
      continue;
    }

    const file = rawFile as File;
    const originalName = file.name;
    const documentId = randomUUID();
    const uploadDir = path.join(process.cwd(), "storage", "documents", documentId);
    await fs.mkdir(uploadDir, { recursive: true });

    const pdfDestination = path.join(uploadDir, "original.pdf");
    await saveFile(file, pdfDestination);

    await convertPdfToPng(pdfDestination, uploadDir);

    const pageFiles = (await fs.readdir(uploadDir)).filter((fileName) => /^page-\d+\.png$/.test(fileName));
    const pageCount = pageFiles.length;

    if (!pageCount) {
      return NextResponse.json({ error: "PDF conversion failed: no page images were generated." }, { status: 500 });
    }

    const document = await prisma.document.create({
      data: {
        id: documentId,
        name: originalName,
        aliasName: originalName,
        originalName,
        type: /invoice/i.test(originalName) ? "INVOICE" : "BANK",
        filePath: `/api/documents/${documentId}/pdf`,
        pdfPath: path.relative(process.cwd(), pdfDestination),
        pageCount,
        sortOrder: sortOrder++,
      },
    });

    createdDocuments.push(document as UploadedDocument);
  }

  if (!createdDocuments.length) {
    return NextResponse.json({ error: "No valid PDF files were uploaded." }, { status: 400 });
  }

  return NextResponse.json(createdDocuments);
}
