import {
  ICreateSite,
  ISite,
  ISiteWithAssetCount,
  IUpdateSite,
} from '@domain/_interfaces/site.interface';
import { SiteRepository } from '@domain/_repositories/site.repository';
import config from '@config/config';
import Boom from '@hapi/boom';
import siteErrors from './sites.errors';

interface SiteRepositories {
  siteRepository: SiteRepository;
}

function siteDomainFactory(repositories: SiteRepositories) {
  const { siteRepository } = repositories;

  async function requireSite(id: string): Promise<ISiteWithAssetCount> {
    const site = await siteRepository.findById(id);
    if (!site) {
      throw Boom.notFound(siteErrors.siteNotFound.message, {
        code: siteErrors.siteNotFound.code,
      });
    }
    return site;
  }

  return {
    async listSites(params: { search?: string; page?: number }): Promise<{
      sites: ISiteWithAssetCount[];
      total: number;
      page: number;
      pageSize: number | null;
    }> {
      // Paginate only when a page is requested; otherwise return every site (the
      // overview map / asset-form dropdown). Page size is server-owned.
      const paginate = params.page !== undefined;
      const page = Math.max(1, params.page ?? 1);
      const { sites, total } = await siteRepository.list({
        search: params.search?.trim() || undefined,
        page: paginate ? page : undefined,
      });
      return { sites, total, page, pageSize: paginate ? config.pagination.pageSize : null };
    },

    async getSiteDetails(id: string): Promise<ISiteWithAssetCount> {
      return requireSite(id);
    },

    async createSite(payload: ICreateSite): Promise<ISite> {
      return siteRepository.create({
        name: payload.name,
        description: payload.description ?? null,
        address: payload.address ?? null,
        latitude: payload.latitude,
        longitude: payload.longitude,
      });
    },

    async updateSite(id: string, payload: IUpdateSite): Promise<ISiteWithAssetCount> {
      await requireSite(id);

      const updateData: IUpdateSite = {};
      if (payload.name !== undefined) updateData.name = payload.name;
      if (payload.description !== undefined) updateData.description = payload.description;
      if (payload.address !== undefined) updateData.address = payload.address;
      if (payload.latitude !== undefined) updateData.latitude = payload.latitude;
      if (payload.longitude !== undefined) updateData.longitude = payload.longitude;

      if (Object.keys(updateData).length > 0) {
        await siteRepository.update(id, updateData);
      }
      return requireSite(id);
    },

    /**
     * Deletes a site. By default linked assets are kept and unlinked (their
     * site_id is cleared by the FK). When `deleteAssets` is true the linked
     * assets are deleted first.
     */
    async deleteSite(id: string, deleteAssets: boolean): Promise<void> {
      await requireSite(id);
      if (deleteAssets) {
        await siteRepository.deleteLinkedAssets(id);
      }
      await siteRepository.delete(id);
    },
  };
}

export default siteDomainFactory;
