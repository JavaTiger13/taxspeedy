import fs from "fs/promises";
import path from "path";

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
   */
  absolutePath(storagePath: string): string;
}

// ─── Local filesystem implementation ────────────────────────────────────────

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

  absolutePath(storagePath: string): string {
    return path.join(STORAGE_ROOT, storagePath);
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

let _provider: StorageProvider | null = null;

/**
 * Returns the active storage provider.
 * To switch to cloud storage, replace LocalStorageProvider with e.g. SupabaseStorageProvider.
 */
export function getStorageProvider(): StorageProvider {
  if (!_provider) {
    _provider = new LocalStorageProvider();
  }
  return _provider;
}
