import config from '@config/config';
import Boom from '@hapi/boom';
import logger from '@services/logger.service';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Disk I/O for the import/export hub (SPEC-IMPORT-001 §12-13). Uploaded source
 * files and generated artifacts (error reports, export files) live under one
 * configurable root with opaque `{uuid}.{ext}` names; the raw path is never
 * exposed to clients (downloads stream through authenticated routes).
 */
const storageDir = path.resolve(config.importExport.storagePath);

function ensureDir(): void {
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
}

function resolvePath(filename: string): string {
  return path.join(storageDir, path.basename(filename));
}

async function store(buffer: Buffer, ext: string): Promise<string> {
  if (!buffer || buffer.length === 0) {
    throw Boom.badRequest('Empty file', { code: 'IEX4000' });
  }
  ensureDir();
  const filename = `${randomUUID()}.${ext}`;
  try {
    await fs.promises.writeFile(resolvePath(filename), buffer);
  } catch (error) {
    logger.error(__filename, 'store', 'failed to store import/export file', error);
    throw Boom.badImplementation('Could not store file', { code: 'IEX5000' });
  }
  return filename;
}

async function read(filename: string): Promise<Buffer> {
  try {
    return await fs.promises.readFile(resolvePath(filename));
  } catch (error) {
    logger.error(__filename, 'read', 'failed to read import/export file', error);
    throw Boom.notFound('Artifact not found', { code: 'IEX4040' });
  }
}

async function remove(filename: string | null | undefined): Promise<void> {
  if (!filename) return;
  try {
    await fs.promises.unlink(resolvePath(filename));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.error(__filename, 'remove', 'failed to delete import/export file', error);
    }
  }
}

/** Deletes artifacts older than the retention window. Called on an interval (§13). */
async function purgeExpired(): Promise<number> {
  if (!fs.existsSync(storageDir)) return 0;
  const cutoff = Date.now() - config.importExport.artifactRetentionDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  try {
    const entries = await fs.promises.readdir(storageDir);
    for (const entry of entries) {
      const full = path.join(storageDir, entry);
      try {
        const stat = await fs.promises.stat(full);
        if (stat.isFile() && stat.mtimeMs < cutoff) {
          await fs.promises.unlink(full);
          removed += 1;
        }
      } catch {
        // Skip entries that vanish mid-sweep.
      }
    }
  } catch (error) {
    logger.error(__filename, 'purgeExpired', 'retention sweep failed', error);
  }
  return removed;
}

export const importFileStorage = {
  resolvePath,
  store,
  read,
  remove,
  purgeExpired,
  exists(filename: string): boolean {
    return fs.existsSync(resolvePath(filename));
  },
};
