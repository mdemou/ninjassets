import { IAssetWithAssignee, IListAssetsResult } from '@domain/_interfaces/asset.interface';
import { IPendingHandover } from '@domain/_interfaces/handover.interface';
import { IListTransactionsResult, ITransaction } from '@domain/_interfaces/transaction.interface';

/** Fields returned by GET /api/me/assets (home map + my assets table). */
export interface IMyAssetListItem {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  status: IAssetWithAssignee['status'];
  assignedAt: string | null;
  manufacturerId: string | null;
  manufacturerName: string | null;
  manufacturerImageFilename: string | null;
  siteName: string | null;
  effectiveLatitude: number | null;
  effectiveLongitude: number | null;
}

/** Fields returned by GET /api/me/transactions (personal history table). */
export interface IMyTransactionListItem {
  id: string;
  dateCreated: string;
  action: ITransaction['action'];
  assetId: string | null;
  assetName: string;
  assetImageFilename: string | null;
  detail: string | null;
}

export function toMyAssetListItem(asset: IAssetWithAssignee): IMyAssetListItem {
  return {
    id: asset.id,
    name: asset.name,
    model: asset.model,
    serialNumber: asset.serialNumber,
    status: asset.status,
    assignedAt: asset.assignedAt,
    manufacturerId: asset.manufacturerId,
    manufacturerName: asset.manufacturerName,
    manufacturerImageFilename: asset.manufacturerImageFilename,
    siteName: asset.siteName,
    effectiveLatitude: asset.effectiveLatitude,
    effectiveLongitude: asset.effectiveLongitude,
  };
}

export function toListMyAssetsApi(result: IListAssetsResult) {
  return {
    assets: result.assets.map(toMyAssetListItem),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  };
}

export function toMyTransactionListItem(tx: ITransaction): IMyTransactionListItem {
  return {
    id: tx.id,
    dateCreated: tx.dateCreated,
    action: tx.action,
    assetId: tx.assetId,
    assetName: tx.assetName,
    assetImageFilename: tx.assetImageFilename,
    detail: tx.detail,
  };
}

export function toListMyTransactionsApi(result: IListTransactionsResult) {
  return {
    transactions: result.transactions.map(toMyTransactionListItem),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  };
}

export function toListPendingHandoversApi(handovers: IPendingHandover[]) {
  return { handovers, total: handovers.length };
}
