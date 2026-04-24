import fs from "fs/promises";
import path from "path";
import { createClient } from "@supabase/supabase-js";

/**
 * StorageProvider defines the contract for all file storage operations.
 * Swap implementations by changing STORAGE_PROVIDER env var.
 */
export interface StorageProvider {
  /**
   * Write a file to storage.
   * @param buffer  File contents
   * @param storagePath  Relative path within storage, e.g. "documents/{id}/original.pdf"
   * @returns The same relative path (for persisting in the DB)
   */
  upload(buffer: Buffer, storagePath: string): Promise<string>;

  /**
   * Delete a file or recursively delete a directory.
   * @param storagePath  Relative path or directory within storage
   */
  delete(storagePath: string): Promise<void>;

  /** Load a file from storage and return its contents as a Buffer. */
  getFile(storagePath: string): Promise<Buffer>;

  /**
   * Return a URL the browser can use to load the file.
   * Local: API route. Supabase: signed URL (1 hour TTL).
   */
  getPublicUrl(storagePath: string): Promise<string>;
}


// ─── Local filesystem implementation ─────────────────────────────────────────

const STORAGE_ROOT = path.join(process.cwd(), "storage");

class LocalStorageProvider implements StorageProvider {
  async upload(buffer: Buffer, storagePath: string): Promise<string> {
    const absolute = path.join(STORAGE_ROOT, storagePath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, buffer);
    return storagePath;
  }

  async delete(storagePath: string): Promise<void> {
    const absolute = path.join(STORAGE_ROOT, storagePath);
    await fs.rm(absolute, { recursive: true, force: true });
  }

  async getFile(storagePath: string): Promise<Buffer> {
    const absolute = path.join(STORAGE_ROOT, storagePath);
    return fs.readFile(absolute);
  }

  async getPublicUrl(storagePath: string): Promise<string> {
    return `/api/storage/${storagePath}`;
  }
}


// ─── Supabase Storage implementation ─────────────────────────────────────────

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET!;

export class SupabaseStorageProvider implements StorageProvider {
  async upload(buffer: Buffer, storagePath: string): Promise<string> {
    console.log("Storage Uploading to: ", storagePath);

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        upsert: true,
        contentType: this.getContentType(storagePath),
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    return storagePath;
  }

  async delete(storagePath: string): Promise<void> {
    console.log("Storage Deleting: ", storagePath);
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(storagePath, { limit: 1000 });

    if (error) {
      throw new Error(`List failed: ${error.message}`);
    }

    if (!data || data.length === 0) return;

    const filesToDelete = data.map((file) => `${storagePath}/${file.name}`);

    const { error: deleteError } = await supabase.storage
      .from(BUCKET)
      .remove(filesToDelete);

    if (deleteError) {
      throw new Error(`Delete failed: ${deleteError.message}`);
    }
  }

  async getFile(storagePath: string): Promise<Buffer> {
    console.log("Storage Getting File: ", storagePath);

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(storagePath);

    if (error || !data) {
      throw new Error(`Download failed: ${error?.message}`);
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async getPublicUrl(storagePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 3600);

    if (error || !data?.signedUrl) {
      throw new Error(`Failed to create signed URL: ${error?.message}`);
    }

    return data.signedUrl;
  }

  private getContentType(filePath: string): string {
    if (filePath.endsWith(".pdf")) return "application/pdf";
    if (filePath.endsWith(".png")) return "image/png";
    if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
    return "application/octet-stream";
  }
}


// ─── Entry point ──────────────────────────────────────────────────────────────

let _provider: StorageProvider | null = null;

/**
 * Returns the active storage provider, selected by STORAGE_PROVIDER env var.
 * STORAGE_PROVIDER="SUPABASE" → SupabaseStorageProvider
 * STORAGE_PROVIDER="LOCAL" or unset → LocalStorageProvider (default)
 */
export function getStorageProvider(): StorageProvider {
  if (!_provider) {
    const mode = process.env.STORAGE_PROVIDER;
    if (mode === "SUPABASE") {
      console.log("Using SUPABASE storage provider");
      _provider = new SupabaseStorageProvider();
    } else {
      console.log("Using LOCAL storage provider");
      _provider = new LocalStorageProvider();
    }
  }
  return _provider;
}





