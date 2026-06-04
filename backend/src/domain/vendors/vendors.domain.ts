import {
  ICreateVendor,
  IUpdateVendor,
  IVendor,
  IVendorWithAssetCount,
} from '@domain/_interfaces/vendor.interface';
import { VendorRepository } from '@domain/_repositories/vendor.repository';
import config from '@config/config';
import Boom from '@hapi/boom';
import { vendorImageStorage } from '@services/uploadedImage.service';
import vendorErrors from './vendors.errors';

interface VendorRepositories {
  vendorRepository: VendorRepository;
}

function vendorDomainFactory(repositories: VendorRepositories) {
  const { vendorRepository } = repositories;

  async function requireVendor(id: string): Promise<IVendorWithAssetCount> {
    const row = await vendorRepository.findById(id);
    if (!row) {
      throw Boom.notFound(vendorErrors.notFound.message, {
        code: vendorErrors.notFound.code,
      });
    }
    return row;
  }

  async function assertNameAvailable(name: string, ignoreId?: string): Promise<void> {
    const existing = await vendorRepository.findByNameNormalized(name);
    if (existing && existing.id !== ignoreId) {
      throw Boom.conflict(vendorErrors.nameAlreadyExists.message, {
        code: vendorErrors.nameAlreadyExists.code,
      });
    }
  }

  return {
    async listVendors(params: { search?: string; page?: number }): Promise<{
      vendors: IVendorWithAssetCount[];
      total: number;
      page: number;
      pageSize: number | null;
    }> {
      const paginate = params.page !== undefined;
      const page = Math.max(1, params.page ?? 1);
      const { vendors, total } = await vendorRepository.list({
        search: params.search?.trim() || undefined,
        page: paginate ? page : undefined,
      });
      return {
        vendors,
        total,
        page,
        pageSize: paginate ? config.pagination.pageSize : null,
      };
    },

    async getVendorDetails(id: string): Promise<IVendorWithAssetCount> {
      return requireVendor(id);
    },

    async createVendor(payload: ICreateVendor): Promise<IVendor> {
      const name = payload.name.trim();
      if (!name) {
        throw Boom.badRequest('name is required');
      }
      await assertNameAvailable(name);
      return vendorRepository.create({ name });
    },

    async updateVendor(id: string, payload: IUpdateVendor): Promise<IVendorWithAssetCount> {
      await requireVendor(id);
      if (payload.name !== undefined) {
        const name = payload.name.trim();
        if (!name) {
          throw Boom.badRequest('name is required');
        }
        await assertNameAvailable(name, id);
        await vendorRepository.update(id, { name });
      }
      return requireVendor(id);
    },

    async deleteVendor(id: string): Promise<void> {
      const existing = await requireVendor(id);
      const count = await vendorRepository.countAssets(id);
      if (count > 0) {
        const err = vendorErrors.inUse(count);
        throw Boom.conflict(err.message, { code: err.code });
      }
      await vendorRepository.delete(id);
      await vendorImageStorage.remove(existing.imageFilename);
    },
  };
}

export default vendorDomainFactory;
