export enum IHandoverType {
  CHECK_OUT = 'CHECK_OUT',
  CHECK_IN = 'CHECK_IN',
}

export enum IHandoverStatus {
  OPEN = 'OPEN',
  CONSUMED = 'CONSUMED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

/** A custody-verification action. The raw token is never stored or returned. */
export interface IHandover {
  id: string;
  dateCreated: string;
  assetId: string;
  type: IHandoverType;
  status: IHandoverStatus;
  targetUserId: string;
  createdByUserId: string | null;
  expiresAt: string;
  consumedAt: string | null;
  consumedByUserId: string | null;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
}

/** Handover enriched with joined display data for admin/preview views. */
export interface IHandoverWithDetails extends IHandover {
  assetName: string;
  assetSerialNumber: string;
  assetImageFilename: string | null;
  targetUserName: string | null;
  targetUserEmail: string | null;
  targetUserAvatarFilename: string | null;
}

export interface ICreateHandover {
  assetId: string;
  type: IHandoverType;
  targetUserId: string;
  createdByUserId: string;
  tokenHash: string;
  expiresAt: Date;
}

/** Open handover awaiting the target user's confirmation (GET /api/me/handovers). */
export interface IPendingHandover {
  id: string;
  type: IHandoverType;
  expiresAt: string;
  assetId: string;
  assetName: string;
  assetSerialNumber: string;
}

export interface IListHandoversResult {
  handovers: IHandoverWithDetails[];
  total: number;
}

export interface IListPendingHandoversResult {
  handovers: IPendingHandover[];
  total: number;
}
