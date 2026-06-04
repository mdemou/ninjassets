import { IStatsOverview } from '@domain/_interfaces/stats.interface';
import { StatsRepository } from '@domain/_repositories/stats.repository';
import { IAssetStatus } from '@domain/_interfaces/asset.interface';
import Boom from '@hapi/boom';
import logger from '@services/logger.service';
import sqlService from '@services/sql.service';
import { getAttentionCounts } from '@infrastructure/repositories/reportsDb/dataQuality.queries';
import statsDbErrors from './statsDb.errors';

const toNum = (value: unknown): number => Number((value as { count?: string } | undefined)?.count ?? 0);

const statsDbRepository: StatsRepository = {
  async getOverview(): Promise<IStatsOverview> {
    try {
      const db = sqlService.myDb;

      const [
        assetsCount,
        sitesCount,
        usersCount,
        assignedCount,
        manufacturersCount,
        vendorsCount,
        byStatusRows,
        bySiteRows,
        byManufacturerRows,
        byVendorRows,
      ] = await Promise.all([
        db('asset').count('* as count').first(),
        db('site').count('* as count').first(),
        db('user').count('* as count').first(),
        db('asset').where('status', IAssetStatus.ASSIGNED).count('* as count').first(),
        db('manufacturer').count('* as count').first(),
        db('vendor').count('* as count').first(),
        db('asset').select('status').count('* as count').groupBy('status'),
        db('asset')
          .leftJoin('site', 'asset.site_id', 'site.id')
          .select('site.id as site_id', 'site.name as site_name')
          .count('asset.id as count')
          .groupBy('site.id', 'site.name')
          .orderBy('count', 'desc'),
        db('asset')
          .leftJoin('manufacturer', 'asset.manufacturer_id', 'manufacturer.id')
          .select('manufacturer.id as manufacturer_id', 'manufacturer.name as manufacturer_name')
          .count('asset.id as count')
          .groupBy('manufacturer.id', 'manufacturer.name')
          .orderBy('count', 'desc'),
        db('asset')
          .leftJoin('vendor', 'asset.vendor_id', 'vendor.id')
          .select('vendor.id as vendor_id', 'vendor.name as vendor_name')
          .count('asset.id as count')
          .groupBy('vendor.id', 'vendor.name')
          .orderBy('count', 'desc'),
      ]);

      return {
        totals: {
          assets: toNum(assetsCount),
          sites: toNum(sitesCount),
          users: toNum(usersCount),
          assignedAssets: toNum(assignedCount),
          manufacturers: toNum(manufacturersCount),
          vendors: toNum(vendorsCount),
        },
        assetsByStatus: (byStatusRows as { status: string; count: string }[]).map((r) => ({
          status: r.status,
          count: Number(r.count),
        })),
        assetsBySite: (bySiteRows as { site_id: string | null; site_name: string | null; count: string }[]).map(
          (r) => ({ siteId: r.site_id, siteName: r.site_name, count: Number(r.count) }),
        ),
        assetsByManufacturer: (
          byManufacturerRows as {
            manufacturer_id: string | null;
            manufacturer_name: string | null;
            count: string;
          }[]
        ).map((r) => ({
          manufacturerId: r.manufacturer_id,
          manufacturerName: r.manufacturer_name,
          count: Number(r.count),
        })),
        assetsByVendor: (
          byVendorRows as { vendor_id: string | null; vendor_name: string | null; count: string }[]
        ).map((r) => ({
          vendorId: r.vendor_id,
          vendorName: r.vendor_name,
          count: Number(r.count),
        })),
        attention: await getAttentionCounts(),
      };
    } catch (error) {
      logger.error(__filename, 'getOverview', 'error', error);
      throw Boom.badImplementation(statsDbErrors.internalError.message, {
        code: statsDbErrors.internalError.code,
      });
    }
  },
};

export default statsDbRepository;
