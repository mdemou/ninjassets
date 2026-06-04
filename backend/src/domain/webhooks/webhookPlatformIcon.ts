import { IWebhookPlatform, WEBHOOK_PLATFORMS } from '@domain/_interfaces/webhook.interface';
import Boom from '@hapi/boom';
import fs from 'fs/promises';
import path from 'path';

const ICON_DIR = path.join(process.cwd(), 'assets');

export async function readWebhookPlatformIconPng(platform: IWebhookPlatform): Promise<Buffer> {
  if (!WEBHOOK_PLATFORMS.includes(platform)) {
    throw Boom.notFound('Platform icon not found');
  }
  const filePath = path.join(ICON_DIR, `${platform}.png`);
  try {
    return await fs.readFile(filePath);
  } catch {
    throw Boom.notFound('Platform icon not found');
  }
}
