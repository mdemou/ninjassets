import { AssetRepository } from '@domain/_repositories/asset.repository';
import Boom from '@hapi/boom';
import { buildAssetDetailUrl, generateAssetQrPng } from '@services/assetQr.service';
import assetQrErrors from './assetQr.errors';

interface AssetQrRepositories {
  assetRepository: AssetRepository;
}

function assetQrDomainFactory(repositories: AssetQrRepositories) {
  const { assetRepository } = repositories;

  return {
    async getQrPng(assetId: string): Promise<Buffer> {
      const asset = await assetRepository.findById(assetId);
      if (!asset) {
        throw Boom.notFound(assetQrErrors.assetNotFound.message, {
          code: assetQrErrors.assetNotFound.code,
        });
      }
      const url = buildAssetDetailUrl(asset.id);
      return generateAssetQrPng(url);
    },
  };
}

export default assetQrDomainFactory;
