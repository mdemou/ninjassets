import Boom from '@hapi/boom';
import type { UploadedImageStorage } from '@services/uploadedImage.service';

export interface CatalogImageEntity {
  id: string;
  imageFilename: string | null;
}

export interface CatalogImageRepository {
  findById(id: string): Promise<CatalogImageEntity | null>;
  updateImageFilename(id: string, filename: string | null): Promise<void>;
}

export interface CatalogImageErrors {
  entityNotFound: { message: string; code: string };
  imageNotFound: { message: string; code: string };
}

function catalogImageDomainFactory(
  repository: CatalogImageRepository,
  errors: CatalogImageErrors,
  storage: UploadedImageStorage,
) {
  async function requireEntity(id: string): Promise<CatalogImageEntity> {
    const entity = await repository.findById(id);
    if (!entity) {
      throw Boom.notFound(errors.entityNotFound.message, {
        code: errors.entityNotFound.code,
      });
    }
    return entity;
  }

  return {
    async setImage(id: string, buffer: Buffer): Promise<void> {
      const entity = await requireEntity(id);
      const filename = await storage.processAndStore(buffer);
      await repository.updateImageFilename(entity.id, filename);
      await storage.remove(entity.imageFilename);
    },

    async removeImage(id: string): Promise<void> {
      const entity = await requireEntity(id);
      if (!entity.imageFilename) return;
      await repository.updateImageFilename(entity.id, null);
      await storage.remove(entity.imageFilename);
    },

    async getImagePath(id: string): Promise<string> {
      const entity = await requireEntity(id);
      if (!entity.imageFilename || !storage.exists(entity.imageFilename)) {
        throw Boom.notFound(errors.imageNotFound.message, {
          code: errors.imageNotFound.code,
        });
      }
      return storage.resolvePath(entity.imageFilename);
    },
  };
}

export default catalogImageDomainFactory;
