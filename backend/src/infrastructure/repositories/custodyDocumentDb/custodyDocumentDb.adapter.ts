import {
  ICustodyDocument,
  ICustodyDocumentWithDetails,
} from '@domain/_interfaces/custodyDocument.interface';
import { ICustodyDocumentDB, ICustodyDocumentWithDetailsDB } from './custodyDocumentDb.interface';

export function adaptCustodyDocument(row: ICustodyDocumentDB): ICustodyDocument {
  return {
    id: row.id,
    dateCreated: row.date_created,
    assetId: row.asset_id,
    type: row.type,
    handoverId: row.handover_id,
    storageFilename: row.storage_filename,
    originalFilename: row.original_filename,
    fileSizeBytes: row.file_size_bytes,
    documentDate: row.document_date,
    conditionAtHandover: row.condition_at_handover,
    accessoriesNote: row.accessories_note,
    notes: row.notes,
    uploadedByUserId: row.uploaded_by_user_id,
  };
}

export function adaptCustodyDocumentWithDetails(
  row: ICustodyDocumentWithDetailsDB,
): ICustodyDocumentWithDetails {
  return {
    ...adaptCustodyDocument(row),
    uploadedByName: row.uploaded_by_name,
  };
}
