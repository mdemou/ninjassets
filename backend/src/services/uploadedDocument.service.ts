import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import config from '@config/config';
import Boom from '@hapi/boom';
import logger from '@services/logger.service';

const STORED_EXT = 'pdf';
// Every PDF starts with the "%PDF-" signature; reject anything else even though
// the route's `allow` list already filters on Content-Type (defense in depth).
const PDF_MAGIC = Buffer.from('%PDF-');

export type UploadedDocumentScope = 'custody';

function storageDirFor(scope: UploadedDocumentScope): string {
  const paths: Record<UploadedDocumentScope, string> = {
    custody: config.uploads.custodyDocumentPath,
  };
  return path.resolve(paths[scope]);
}

export interface UploadedDocumentStorage {
  resolvePath(filename: string): string;
  /** Validate the buffer is a PDF and persist it under an opaque `{uuid}.pdf` name. */
  storeBytes(buffer: Buffer): Promise<string>;
  remove(filename: string | null | undefined): Promise<void>;
  exists(filename: string): boolean;
}

export function createUploadedDocumentService(scope: UploadedDocumentScope): UploadedDocumentStorage {
  const storageDir = storageDirFor(scope);

  function ensureDir(): void {
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
  }

  function resolvePath(filename: string): string {
    return path.join(storageDir, path.basename(filename));
  }

  return {
    resolvePath,

    async storeBytes(buffer: Buffer): Promise<string> {
      if (!buffer || buffer.length === 0 || !buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
        throw Boom.badRequest('Uploaded file is not a valid PDF', { code: 'INVALID_PDF' });
      }
      ensureDir();
      const filename = `${randomUUID()}.${STORED_EXT}`;
      try {
        await fs.promises.writeFile(resolvePath(filename), buffer);
      } catch (error) {
        logger.error(__filename, 'storeBytes', 'failed to store custody document', error);
        throw Boom.badImplementation('Could not store custody document');
      }
      return filename;
    },

    async remove(filename: string | null | undefined): Promise<void> {
      if (!filename) return;
      try {
        await fs.promises.unlink(resolvePath(filename));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          logger.error(__filename, 'remove', 'failed to delete custody document', error);
        }
      }
    },

    exists(filename: string): boolean {
      return fs.existsSync(resolvePath(filename));
    },
  };
}

export const custodyDocumentStorage = createUploadedDocumentService('custody');
