import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import config from '@config/config';
import Boom from '@hapi/boom';
import logger from '@services/logger.service';

const STORED_EXT = 'webp';

export type UploadedImageScope = 'avatar' | 'asset' | 'manufacturer' | 'vendor';

function storageDirFor(scope: UploadedImageScope): string {
  const paths: Record<UploadedImageScope, string> = {
    avatar: config.uploads.avatarPath,
    asset: config.uploads.assetImagePath,
    manufacturer: config.uploads.manufacturerImagePath,
    vendor: config.uploads.vendorImagePath,
  };
  return path.resolve(paths[scope]);
}

export interface UploadedImageStorage {
  resolvePath(filename: string): string;
  processAndStore(buffer: Buffer): Promise<string>;
  remove(filename: string | null | undefined): Promise<void>;
  exists(filename: string): boolean;
}

export function createUploadedImageService(scope: UploadedImageScope): UploadedImageStorage {
  const storageDir = storageDirFor(scope);
  const logLabels: Record<UploadedImageScope, string> = {
    avatar: 'avatar',
    asset: 'asset image',
    manufacturer: 'manufacturer image',
    vendor: 'vendor image',
  };
  const logLabel = logLabels[scope];

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

    async processAndStore(buffer: Buffer): Promise<string> {
      ensureDir();
      const size = config.uploads.imageSize;
      const filename = `${randomUUID()}.${STORED_EXT}`;
      try {
        await sharp(buffer)
          .rotate()
          .resize(size, size, { fit: 'cover', position: 'centre' })
          .webp({ quality: 82 })
          .toFile(resolvePath(filename));
      } catch (error) {
        logger.error(__filename, 'processAndStore', `invalid ${logLabel}`, error);
        throw Boom.badRequest('Uploaded file is not a valid image', { code: 'INVALID_IMAGE' });
      }
      return filename;
    },

    async remove(filename: string | null | undefined): Promise<void> {
      if (!filename) return;
      try {
        await fs.promises.unlink(resolvePath(filename));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          logger.error(__filename, 'remove', `failed to delete ${logLabel}`, error);
        }
      }
    },

    exists(filename: string): boolean {
      return fs.existsSync(resolvePath(filename));
    },
  };
}

export const avatarImageStorage = createUploadedImageService('avatar');
export const assetImageStorage = createUploadedImageService('asset');
export const manufacturerImageStorage = createUploadedImageService('manufacturer');
export const vendorImageStorage = createUploadedImageService('vendor');
