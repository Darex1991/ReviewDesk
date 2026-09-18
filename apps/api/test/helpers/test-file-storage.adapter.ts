import { FileStorageAdapter } from "src/file-storage/adapters/file-storage.adapter";
import {
  UploadFileInput,
  UploadFileResult,
} from "src/file-storage/file-storage.types";

/** In-memory storage adapter for tests: no S3 needed. */
export class InMemoryFileStorageAdapter extends FileStorageAdapter {
  readonly objects = new Map<string, Buffer>();

  async uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
    const body = input.body;
    const buffer = Buffer.isBuffer(body)
      ? body
      : typeof body === "string"
        ? Buffer.from(body)
        : body instanceof Uint8Array
          ? Buffer.from(body)
          : Buffer.alloc(0);

    this.objects.set(input.key, buffer);

    return { bucket: "test-bucket", key: input.key, eTag: "test" };
  }

  async downloadFile(key: string): Promise<Buffer> {
    const object = this.objects.get(key);
    if (!object) {
      throw new Error(`Object ${key} not found`);
    }
    return object;
  }

  async deleteFile(key: string): Promise<void> {
    this.objects.delete(key);
  }
}
