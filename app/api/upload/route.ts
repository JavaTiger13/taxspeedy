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

function normalizePageFiles(outputDir: string) {
  return fs.readdir(outputDir).then((files) => {
    const pageFiles = files
      .filter((fileName) => /^page-(\d+)\.png$/.test(fileName))
      .map((fileName) => {
        const match = fileName.match(/^page-(\d+)\.png$/);
        return {
          fileName,
          pageNumber: match ? Number(match[1]) : 0,
        };
      })
      .sort((a, b) => a.pageNumber - b.pageNumber);

    return Promise.all(
      pageFiles.map(async ({ fileName }, index) => {
        const expectedName = `page-${index + 1}.png`;
        if (fileName === expectedName) {
          return expectedName;
        }

        const currentPath = path.join(outputDir, fileName);
        const tempPath = path.join(outputDir, `${expectedName}.tmp`);
        const finalPath = path.join(outputDir, expectedName);

        await fs.rename(currentPath, tempPath);
        await fs.rename(tempPath, finalPath);
        return expectedName;
      })
    );
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const files = formData.getAll("files");
  const uploadType = String(formData.get("type") ?? "BANK").toUpperCase();
  const validTypes = new Set(["BANK", "INVOICE"]);
  const type = validTypes.has(uploadType) ? (uploadType as "BANK" | "INVOICE") : "BANK";

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
    const originalName = file.name.normalize("NFC");
    const documentId = randomUUID();
    const uploadDir = path.join(process.cwd(), "storage", "documents", documentId);
    await fs.mkdir(uploadDir, { recursive: true });

    const pdfDestination = path.join(uploadDir, "original.pdf");
    await saveFile(file, pdfDestination);

    await convertPdfToPng(pdfDestination, uploadDir);
    const normalizedFiles = await normalizePageFiles(uploadDir);
    const pageCount = normalizedFiles.length;

    if (!pageCount) {
      return NextResponse.json({ error: "PDF conversion failed: no page images were generated." }, { status: 500 });
    }

    const document = await prisma.document.create({
      data: {
        id: documentId,
        name: originalName,
        aliasName: originalName,
        originalName,
        type,
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
