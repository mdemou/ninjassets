import { ICustodyDocumentType } from '@domain/_interfaces/custodyDocument.interface';

export interface ICustodyDocumentDB {
  id: string;
  date_created: string;
  asset_id: string;
  type: ICustodyDocumentType;
  handover_id: string | null;
  storage_filename: string;
  original_filename: string;
  file_size_bytes: number;
  document_date: string | null;
  condition_at_handover: string | null;
  accessories_note: string | null;
  notes: string | null;
  uploaded_by_user_id: string | null;
}

export interface ICustodyDocumentWithDetailsDB extends ICustodyDocumentDB {
  uploaded_by_name: string | null;
}
