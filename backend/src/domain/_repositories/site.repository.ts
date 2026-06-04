import {
  ICreateSite,
  ISite,
  ISiteWithAssetCount,
  IUpdateSite,
} from '@domain/_interfaces/site.interface';

export interface SiteRepository {
  list(params: { search?: string; page?: number }): Promise<{
    sites: ISiteWithAssetCount[];
    total: number;
  }>;
  findById(id: string): Promise<ISiteWithAssetCount | null>;
  create(data: ICreateSite): Promise<ISite>;
  update(id: string, data: IUpdateSite): Promise<void>;
  /** Number of assets currently linked to the site. */
  countAssets(id: string): Promise<number>;
  /** Deletes every asset linked to the site (used when the admin opts in). */
  deleteLinkedAssets(id: string): Promise<void>;
  /** Removes the site. Linked assets are unlinked via the FK (ON DELETE SET NULL). */
  delete(id: string): Promise<void>;
}
