import {
  ICreateCustodyDocument,
  ICustodyDocument,
  ICustodyDocumentWithDetails,
} from '@domain/_interfaces/custodyDocument.interface';

export interface CustodyDocumentRepository {
  create(data: ICreateCustodyDocument): Promise<ICustodyDocument>;
  /** A single document scoped to its asset (null if not found for that asset). */
  findByAssetAndId(assetId: string, id: string): Promise<ICustodyDocumentWithDetails | null>;
  /** All documents for an asset, newest first. */
  listByAssetId(assetId: string): Promise<ICustodyDocumentWithDetails[]>;
  delete(id: string): Promise<void>;
}
