import fs from "fs/promises";
import path from "path";
import { createClient } from "@supabase/supabase-js";

/**
 * StorageProvider defines the contract for all file storage operations.
 * Swap implementations (e.g. SupabaseStorageProvider) by changing getStorageProvider().
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

  /**
   * Resolve a relative storage path to an absolute filesystem path.
   * For local storage only – used by serving routes to read file bytes.
   * 
   * absolutePath(storagePath: string): string;
   */

  /** loads File from storage */
  getFile(storagePath: string): Promise<Buffer>;
}




// ─── Local filesystem implementation ────────────────────────────────────────

/* const STORAGE_ROOT = path.join(process.cwd(), "storage");

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

  absolutePath(storagePath: string): string {
    return path.join(STORAGE_ROOT, storagePath);
  }
} */


// ─── Supabase Storage implementation ────────────────────────────────────────

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

/*   async delete(storagePath: string): Promise<void> {
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([storagePath]);

    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }
  } */

  async delete(storagePath: string): Promise<void> {
    console.log("Storage Deleting : ", storagePath);
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
    console.log("Storage Geeting File : ", storagePath);

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(storagePath);

    if (error || !data) {
      throw new Error(`Download failed: ${error?.message}`);
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private getContentType(path: string): string {
    if (path.endsWith(".pdf")) return "application/pdf";
    if (path.endsWith(".png")) return "image/png";
    if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
    return "application/octet-stream";
  }
}



// ─── Entry point ─────────────────────────────────────────────────────────────

let _provider: StorageProvider | null = null;

/**
 * Returns the active storage provider.
 * To switch to cloud storage, replace LocalStorageProvider with e.g. SupabaseStorageProvider.
 */
/* export function getStorageProvider(): StorageProvider {
  if (!_provider) {
    _provider = new LocalStorageProvider();
  }
  return _provider;
 */

  export function getStorageProvider(): StorageProvider {
    if (!_provider) {
    _provider = new SupabaseStorageProvider();
  }
  return _provider;
}