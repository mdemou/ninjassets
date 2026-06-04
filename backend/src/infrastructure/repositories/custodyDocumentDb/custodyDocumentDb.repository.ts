import {
  ICreateCustodyDocument,
  ICustodyDocument,
  ICustodyDocumentWithDetails,
} from '@domain/_interfaces/custodyDocument.interface';
import { CustodyDocumentRepository } from '@domain/_repositories/custodyDocument.repository';
import Boom from '@hapi/boom';
import logger from '@services/logger.service';
import sqlService from '@services/sql.service';
import {
  adaptCustodyDocument,
  adaptCustodyDocumentWithDetails,
} from './custodyDocumentDb.adapter';
import custodyDocumentDbErrors from './custodyDocumentDb.errors';
import { ICustodyDocumentDB, ICustodyDocumentWithDetailsDB } from './custodyDocumentDb.interface';

/** Columns + uploader join for the enriched read shape. */
function detailsQuery() {
  return sqlService
    .myDb('asset_custody_document')
    .leftJoin(
      { uploader: 'user' },
      'asset_custody_document.uploaded_by_user_id',
      'uploader.id',
    )
    .select('asset_custody_document.*', 'uploader.display_name as uploaded_by_name');
}

function internal(): never {
  throw Boom.badImplementation(custodyDocumentDbErrors.internalError.message, {
    code: custodyDocumentDbErrors.internalError.code,
  });
}

const custodyDocumentDbRepository: CustodyDocumentRepository = {
  async create(data: ICreateCustodyDocument): Promise<ICustodyDocument> {
    try {
      const [row]: ICustodyDocumentDB[] = await sqlService
        .myDb('asset_custody_document')
        .insert({
          asset_id: data.assetId,
          type: data.type,
          handover_id: data.handoverId,
          storage_filename: data.storageFilename,
          original_filename: data.originalFilename,
          file_size_bytes: data.fileSizeBytes,
          document_date: data.documentDate,
          condition_at_handover: data.conditionAtHandover,
          accessories_note: data.accessoriesNote,
          notes: data.notes,
          uploaded_by_user_id: data.uploadedByUserId,
        })
        .returning('*');
      if (!row) return internal();
      return adaptCustodyDocument(row);
    } catch (error) {
      logger.error(__filename, 'create', 'error', error);
      return internal();
    }
  },

  async findByAssetAndId(assetId: string, id: string): Promise<ICustodyDocumentWithDetails | null> {
    try {
      const row: ICustodyDocumentWithDetailsDB | undefined = await detailsQuery()
        .where('asset_custody_document.id', id)
        .where('asset_custody_document.asset_id', assetId)
        .first();
      return row ? adaptCustodyDocumentWithDetails(row) : null;
    } catch (error) {
      logger.error(__filename, 'findByAssetAndId', 'error', error);
      return internal();
    }
  },

  async listByAssetId(assetId: string): Promise<ICustodyDocumentWithDetails[]> {
    try {
      const rows: ICustodyDocumentWithDetailsDB[] = await detailsQuery()
        .where('asset_custody_document.asset_id', assetId)
        .orderBy('asset_custody_document.date_created', 'desc');
      return rows.map(adaptCustodyDocumentWithDetails);
    } catch (error) {
      logger.error(__filename, 'listByAssetId', 'error', error);
      return internal();
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await sqlService.myDb('asset_custody_document').where({ id }).del();
    } catch (error) {
      logger.error(__filename, 'delete', 'error', error);
      return internal();
    }
  },
};

export default custodyDocumentDbRepository;
