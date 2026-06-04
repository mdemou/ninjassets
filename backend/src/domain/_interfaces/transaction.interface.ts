export enum ITransactionAction {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  ASSIGNED = 'ASSIGNED',
  UNASSIGNED = 'UNASSIGNED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  SITE_CHANGED = 'SITE_CHANGED',
  MANUFACTURER_CHANGED = 'MANUFACTURER_CHANGED',
  VENDOR_CHANGED = 'VENDOR_CHANGED',
  PARENT_CHANGED = 'PARENT_CHANGED',
  CATEGORY_CHANGED = 'CATEGORY_CHANGED',
  CUSTOM_FIELDS_CHANGED = 'CUSTOM_FIELDS_CHANGED',
  WARRANTY_CHANGED = 'WARRANTY_CHANGED',
  RETURN_DATE_CHANGED = 'RETURN_DATE_CHANGED',
  HANDOVER_CREATED = 'HANDOVER_CREATED',
  HANDOVER_CANCELLED = 'HANDOVER_CANCELLED',
  CUSTODY_ACCEPTED = 'CUSTODY_ACCEPTED',
  CUSTODY_COMPLETED_ON_BEHALF = 'CUSTODY_COMPLETED_ON_BEHALF',
  CUSTODY_DOCUMENT_UPLOADED = 'CUSTODY_DOCUMENT_UPLOADED',
  CUSTODY_DOCUMENT_DELETED = 'CUSTODY_DOCUMENT_DELETED',
  DELETED = 'DELETED',
}

export interface ITransaction {
  id: string;
  dateCreated: string;
  action: ITransactionAction;
  assetId: string | null;
  assetName: string;
  assetImageFilename: string | null;
  actorUserId: string | null;
  actorName: string | null;
  actorAvatarFilename: string | null;
  targetUserId: string | null;
  targetName: string | null;
  targetAvatarFilename: string | null;
  detail: string | null;
}

/** A row to insert into the audit log. */
export interface ICreateTransaction {
  action: ITransactionAction;
  assetId: string | null;
  assetName: string;
  actorUserId: string | null;
  actorName: string | null;
  targetUserId: string | null;
  targetName: string | null;
  detail?: string | null;
}

export interface IListTransactionsParams {
  search?: string;
  page?: number;
  /** When set, restricts to events concerning this user (their personal history). */
  targetUserId?: string;
  /** When set, restricts to events for this asset. */
  assetId?: string;
}

export interface IListTransactionsResult {
  transactions: ITransaction[];
  total: number;
  page: number;
  pageSize: number;
}
