export enum ICustodyDocumentType {
  CHECK_OUT = 'CHECK_OUT',
  CHECK_IN = 'CHECK_IN',
}

/** A signed custody receipt archived against an asset (SPEC-CUSTODY-DOC-001). */
export interface ICustodyDocument {
  id: string;
  dateCreated: string;
  assetId: string;
  type: ICustodyDocumentType;
  handoverId: string | null;
  storageFilename: string;
  originalFilename: string;
  fileSizeBytes: number;
  documentDate: string | null;
  conditionAtHandover: string | null;
  accessoriesNote: string | null;
  notes: string | null;
  uploadedByUserId: string | null;
}

/** Custody document enriched with the uploader's display name for list views. */
export interface ICustodyDocumentWithDetails extends ICustodyDocument {
  uploadedByName: string | null;
}

export interface ICreateCustodyDocument {
  assetId: string;
  type: ICustodyDocumentType;
  handoverId: string | null;
  storageFilename: string;
  originalFilename: string;
  fileSizeBytes: number;
  documentDate: string | null;
  conditionAtHandover: string | null;
  accessoriesNote: string | null;
  notes: string | null;
  uploadedByUserId: string | null;
}
