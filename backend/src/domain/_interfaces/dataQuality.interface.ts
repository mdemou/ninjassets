export enum IDataQualityIssue {
  INACTIVE_USER_ASSIGNED = 'INACTIVE_USER_ASSIGNED',
  ASSIGNED_WITHOUT_USER = 'ASSIGNED_WITHOUT_USER',
  WARRANTY_EXPIRED = 'WARRANTY_EXPIRED',
  WARRANTY_EXPIRING_SOON = 'WARRANTY_EXPIRING_SOON',
  RETURN_OVERDUE = 'RETURN_OVERDUE',
  RETURN_DUE_SOON = 'RETURN_DUE_SOON',
}

export type IDataQualitySeverity = 'high' | 'medium' | 'low';

export interface IDataQualityRow {
  issue: IDataQualityIssue;
  severity: IDataQualitySeverity;
  assetId: string;
  assetName: string;
  serialNumber: string;
  assignedUserId: string | null;
  assignedUserName: string | null;
  assignedUserEmail: string | null;
  assignedUserAvatarFilename: string | null;
  detail: string | null;
}

export interface IListDataQualityParams {
  search?: string;
  page?: number;
  issue?: IDataQualityIssue;
  limit?: number;
}

export interface IListDataQualityResult {
  rows: IDataQualityRow[];
  total: number;
  page: number;
  pageSize: number | null;
}

export interface IAttentionCounts {
  inactiveUserAssignedCount: number;
  assignedWithoutUserCount: number;
  warrantyExpiredCount: number;
  warrantyExpiring30DaysCount: number;
  returnOverdueCount: number;
  returnDueSoon7DaysCount: number;
}

export interface IAlertsResult {
  alerts: IDataQualityRow[];
  total: number;
}
