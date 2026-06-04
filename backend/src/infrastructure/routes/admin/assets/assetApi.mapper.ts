import { IAssetWithAssignee, IListAssetsResult } from '@domain/_interfaces/asset.interface';
import { buildAssetDetailUrl } from '@services/assetQr.service';

export type IAssetApi = IAssetWithAssignee & { detailUrl: string };

export function toAssetApi(asset: IAssetWithAssignee): IAssetApi {
  return { ...asset, detailUrl: buildAssetDetailUrl(asset.id) };
}

export function toListAssetsApi(result: IListAssetsResult) {
  return {
    ...result,
    assets: result.assets.map(toAssetApi),
  };
}
