import {
  ICreateHandover,
  IHandover,
  IHandoverWithDetails,
  IPendingHandover,
} from '@domain/_interfaces/handover.interface';

export interface HandoverRepository {
  create(data: ICreateHandover): Promise<IHandover>;
  findById(id: string): Promise<IHandoverWithDetails | null>;
  findByTokenHash(tokenHash: string): Promise<IHandoverWithDetails | null>;
  /** The current OPEN handover for an asset (does not consider expiry). */
  findOpenByAssetId(assetId: string): Promise<IHandover | null>;
  /** Last N handovers for an asset, newest first. */
  listByAssetId(assetId: string, limit: number): Promise<IHandoverWithDetails[]>;
  /** All OPEN handovers across all assets, newest first. */
  listAllOpen(limit: number): Promise<IHandoverWithDetails[]>;
  /** OPEN, non-expired handovers for a target user, newest first. */
  listOpenByTargetUserId(targetUserId: string, limit: number): Promise<IPendingHandover[]>;
  /**
   * Atomically consume an OPEN handover (compare-and-set). Returns the updated row
   * only if it was OPEN; null if it was already consumed/cancelled/expired or gone.
   * Prevents double-accept races.
   */
  consume(id: string, consumedByUserId: string): Promise<IHandover | null>;
  /** Atomically cancel an OPEN handover. Returns true if a row transitioned. */
  cancel(id: string, cancelledByUserId: string): Promise<boolean>;
  /** Lazily flip a stale OPEN row to EXPIRED. Returns true if a row transitioned. */
  expire(id: string): Promise<boolean>;
}
