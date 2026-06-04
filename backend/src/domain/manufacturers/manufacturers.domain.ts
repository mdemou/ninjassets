import {
  ICreateManufacturer,
  IManufacturer,
  IManufacturerWithAssetCount,
  IUpdateManufacturer,
} from '@domain/_interfaces/manufacturer.interface';
import { ManufacturerRepository } from '@domain/_repositories/manufacturer.repository';
import config from '@config/config';
import Boom from '@hapi/boom';
import { manufacturerImageStorage } from '@services/uploadedImage.service';
import manufacturerErrors from './manufacturers.errors';

interface ManufacturerRepositories {
  manufacturerRepository: ManufacturerRepository;
}

function manufacturerDomainFactory(repositories: ManufacturerRepositories) {
  const { manufacturerRepository } = repositories;

  async function requireManufacturer(id: string): Promise<IManufacturerWithAssetCount> {
    const row = await manufacturerRepository.findById(id);
    if (!row) {
      throw Boom.notFound(manufacturerErrors.notFound.message, {
        code: manufacturerErrors.notFound.code,
      });
    }
    return row;
  }

  async function assertNameAvailable(name: string, ignoreId?: string): Promise<void> {
    const existing = await manufacturerRepository.findByNameNormalized(name);
    if (existing && existing.id !== ignoreId) {
      throw Boom.conflict(manufacturerErrors.nameAlreadyExists.message, {
        code: manufacturerErrors.nameAlreadyExists.code,
      });
    }
  }

  return {
    async listManufacturers(params: { search?: string; page?: number }): Promise<{
      manufacturers: IManufacturerWithAssetCount[];
      total: number;
      page: number;
      pageSize: number | null;
    }> {
      const paginate = params.page !== undefined;
      const page = Math.max(1, params.page ?? 1);
      const { manufacturers, total } = await manufacturerRepository.list({
        search: params.search?.trim() || undefined,
        page: paginate ? page : undefined,
      });
      return {
        manufacturers,
        total,
        page,
        pageSize: paginate ? config.pagination.pageSize : null,
      };
    },

    async getManufacturerDetails(id: string): Promise<IManufacturerWithAssetCount> {
      return requireManufacturer(id);
    },

    async createManufacturer(payload: ICreateManufacturer): Promise<IManufacturer> {
      const name = payload.name.trim();
      if (!name) {
        throw Boom.badRequest('name is required');
      }
      await assertNameAvailable(name);
      return manufacturerRepository.create({ name });
    },

    async updateManufacturer(id: string, payload: IUpdateManufacturer): Promise<IManufacturerWithAssetCount> {
      await requireManufacturer(id);
      if (payload.name !== undefined) {
        const name = payload.name.trim();
        if (!name) {
          throw Boom.badRequest('name is required');
        }
        await assertNameAvailable(name, id);
        await manufacturerRepository.update(id, { name });
      }
      return requireManufacturer(id);
    },

    async deleteManufacturer(id: string): Promise<void> {
      const existing = await requireManufacturer(id);
      const count = await manufacturerRepository.countAssets(id);
      if (count > 0) {
        const err = manufacturerErrors.inUse(count);
        throw Boom.conflict(err.message, { code: err.code });
      }
      await manufacturerRepository.delete(id);
      await manufacturerImageStorage.remove(existing.imageFilename);
    },
  };
}

export default manufacturerDomainFactory;
