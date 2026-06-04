import { AssetRepository } from '@domain/_repositories/asset.repository';
import Boom from '@hapi/boom';
import { assetImageStorage, type UploadedImageStorage } from '@services/uploadedImage.service';
import assetImageErrors from './assetImage.errors';

interface AssetImageRepositories {
  assetRepository: AssetRepository;
}

function assetImageDomainFactory(
  repositories: AssetImageRepositories,
  storage: UploadedImageStorage = assetImageStorage,
) {
  const { assetRepository } = repositories;

  async function requireAsset(assetId: string) {
    const asset = await assetRepository.findById(assetId);
    if (!asset) {
      throw Boom.notFound(assetImageErrors.assetNotFound.message, {
        code: assetImageErrors.assetNotFound.code,
      });
    }
    return asset;
  }

  return {
    async setImage(assetId: string, buffer: Buffer): Promise<void> {
      const asset = await requireAsset(assetId);
      const filename = await storage.processAndStore(buffer);
      await assetRepository.updateImageFilename(asset.id, filename);
      await storage.remove(asset.imageFilename);
    },

    async removeImage(assetId: string): Promise<void> {
      const asset = await requireAsset(assetId);
      if (!asset.imageFilename) return;
      await assetRepository.updateImageFilename(asset.id, null);
      await storage.remove(asset.imageFilename);
    },

    async getImagePath(assetId: string): Promise<string> {
      const asset = await requireAsset(assetId);
      if (!asset.imageFilename || !storage.exists(asset.imageFilename)) {
        throw Boom.notFound(assetImageErrors.imageNotFound.message, {
          code: assetImageErrors.imageNotFound.code,
        });
      }
      return storage.resolvePath(asset.imageFilename);
    },
  };
}

export default assetImageDomainFactory;
