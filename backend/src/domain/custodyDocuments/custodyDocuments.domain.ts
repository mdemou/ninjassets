import { randomUUID } from 'crypto';
import { IAssetStatus, IAssetWithAssignee } from '@domain/_interfaces/asset.interface';
import {
  ICustodyDocumentType,
  ICustodyDocumentWithDetails,
} from '@domain/_interfaces/custodyDocument.interface';
import { ICreateTransaction, ITransactionAction } from '@domain/_interfaces/transaction.interface';
import { AssetRepository } from '@domain/_repositories/asset.repository';
import { CustodyDocumentRepository } from '@domain/_repositories/custodyDocument.repository';
import { TransactionRepository } from '@domain/_repositories/transaction.repository';
import { UserRepository } from '@domain/_repositories/user.repository';
import Boom from '@hapi/boom';
import logger from '@services/logger.service';
import {
  CustodyLocale,
  CustodyPdfAsset,
  renderCustodyDocumentPdf,
} from '@services/custodyDocumentPdf.service';
import {
  custodyDocumentStorage,
  type UploadedDocumentStorage,
} from '@services/uploadedDocument.service';
import custodyDocumentErrors from './custodyDocuments.errors';

interface CustodyDocumentRepositories {
  custodyDocumentRepository: CustodyDocumentRepository;
  assetRepository: AssetRepository;
  userRepository: UserRepository;
  transactionRepository: TransactionRepository;
}

interface Actor {
  id: string;
  role: string;
}

interface UploadInput {
  type: ICustodyDocumentType;
  handoverId?: string | null;
  documentDate?: string | null;
  notes?: string | null;
  /** User-facing name of the uploaded file (from the client). */
  originalFilename?: string | null;
}

interface GenerateInput {
  type: ICustodyDocumentType;
  targetUserId?: string | null;
  handoverId?: string | null;
  condition?: string | null;
  accessoriesNote?: string | null;
}

/** Projects an asset record onto the slim shape the PDF grid needs. */
function toPdfAsset(asset: IAssetWithAssignee): CustodyPdfAsset {
  return {
    id: asset.id,
    name: asset.name,
    model: asset.model,
    serialNumber: asset.serialNumber,
    categoryName: asset.categoryName,
    siteName: asset.siteName,
    manufacturerName: asset.manufacturerName,
    vendorName: asset.vendorName,
  };
}

function custodyDocumentDomainFactory(
  repositories: CustodyDocumentRepositories,
  storage: UploadedDocumentStorage = custodyDocumentStorage,
) {
  const { custodyDocumentRepository, assetRepository, userRepository, transactionRepository } =
    repositories;

  async function requireAsset(assetId: string) {
    const asset = await assetRepository.findById(assetId);
    if (!asset) {
      throw Boom.notFound(custodyDocumentErrors.assetNotFound.message, {
        code: custodyDocumentErrors.assetNotFound.code,
      });
    }
    return asset;
  }

  function assertValidType(type: ICustodyDocumentType): void {
    if (type !== ICustodyDocumentType.CHECK_OUT && type !== ICustodyDocumentType.CHECK_IN) {
      throw Boom.badRequest(custodyDocumentErrors.invalidType.message, {
        code: custodyDocumentErrors.invalidType.code,
      });
    }
  }

  async function actorNameOf(actorId: string): Promise<string | null> {
    const actor = await userRepository.findById(actorId);
    return actor?.displayName ?? null;
  }

  /** Best-effort audit write — never fails the main flow. */
  async function recordEvent(event: ICreateTransaction): Promise<void> {
    try {
      await transactionRepository.createMany([event]);
    } catch (error) {
      logger.error(__filename, 'recordEvent', 'Failed to record custody document history', error);
    }
  }

  return {
    async listForAsset(assetId: string): Promise<ICustodyDocumentWithDetails[]> {
      await requireAsset(assetId);
      return custodyDocumentRepository.listByAssetId(assetId);
    },

    async getDocument(assetId: string, documentId: string): Promise<ICustodyDocumentWithDetails> {
      await requireAsset(assetId);
      const doc = await custodyDocumentRepository.findByAssetAndId(assetId, documentId);
      if (!doc) {
        throw Boom.notFound(custodyDocumentErrors.documentNotFound.message, {
          code: custodyDocumentErrors.documentNotFound.code,
        });
      }
      return doc;
    },

    async uploadSigned(
      assetId: string,
      buffer: Buffer,
      input: UploadInput,
      actor: Actor,
    ): Promise<ICustodyDocumentWithDetails> {
      const asset = await requireAsset(assetId);
      assertValidType(input.type);

      // storeBytes re-checks the %PDF- magic bytes (defense in depth).
      const storageFilename = await storage.storeBytes(buffer);

      let created;
      try {
        created = await custodyDocumentRepository.create({
          assetId,
          type: input.type,
          handoverId: input.handoverId ?? null,
          storageFilename,
          originalFilename: input.originalFilename?.trim() || 'signed-receipt.pdf',
          fileSizeBytes: buffer.length,
          documentDate: input.documentDate ?? null,
          conditionAtHandover: null,
          accessoriesNote: null,
          notes: input.notes ?? null,
          uploadedByUserId: actor.id,
        });
      } catch (error) {
        // Roll back the orphaned file if the row insert fails.
        await storage.remove(storageFilename);
        throw error;
      }

      const actorName = await actorNameOf(actor.id);
      await recordEvent({
        action: ITransactionAction.CUSTODY_DOCUMENT_UPLOADED,
        assetId: asset.id,
        assetName: asset.name,
        actorUserId: actor.id,
        actorName,
        targetUserId: asset.assignedUserId,
        targetName: asset.assignedUserName,
        detail: `${input.type} (${created.id})`,
      });

      const detail = await custodyDocumentRepository.findByAssetAndId(assetId, created.id);
      return detail ?? { ...created, uploadedByName: actorName };
    },

    async getFilePath(assetId: string, documentId: string): Promise<string> {
      await requireAsset(assetId);
      const doc = await custodyDocumentRepository.findByAssetAndId(assetId, documentId);
      if (!doc) {
        throw Boom.notFound(custodyDocumentErrors.documentNotFound.message, {
          code: custodyDocumentErrors.documentNotFound.code,
        });
      }
      if (!storage.exists(doc.storageFilename)) {
        throw Boom.notFound(custodyDocumentErrors.fileMissing.message, {
          code: custodyDocumentErrors.fileMissing.code,
        });
      }
      return storage.resolvePath(doc.storageFilename);
    },

    async deleteDocument(assetId: string, documentId: string, actor: Actor): Promise<void> {
      const asset = await requireAsset(assetId);
      const doc = await custodyDocumentRepository.findByAssetAndId(assetId, documentId);
      if (!doc) {
        throw Boom.notFound(custodyDocumentErrors.documentNotFound.message, {
          code: custodyDocumentErrors.documentNotFound.code,
        });
      }
      await custodyDocumentRepository.delete(doc.id);
      await storage.remove(doc.storageFilename);

      const actorName = await actorNameOf(actor.id);
      await recordEvent({
        action: ITransactionAction.CUSTODY_DOCUMENT_DELETED,
        assetId: asset.id,
        assetName: asset.name,
        actorUserId: actor.id,
        actorName,
        targetUserId: asset.assignedUserId,
        targetName: asset.assignedUserName,
        detail: `${doc.type} (${doc.id})`,
      });
    },

    async generate(
      assetId: string,
      input: GenerateInput,
      locale: CustodyLocale = 'en',
    ): Promise<Buffer> {
      const asset = await requireAsset(assetId);
      assertValidType(input.type);

      let employeeName: string | null;
      let employeeEmail: string | null;

      if (input.type === ICustodyDocumentType.CHECK_IN) {
        if (asset.status !== IAssetStatus.ASSIGNED) {
          throw Boom.badRequest(custodyDocumentErrors.notAssigned.message, {
            code: custodyDocumentErrors.notAssigned.code,
          });
        }
        employeeName = asset.assignedUserName;
        employeeEmail = asset.assignedUserEmail;
      } else if (input.targetUserId) {
        const user = await userRepository.findById(input.targetUserId);
        if (!user) {
          throw Boom.notFound(custodyDocumentErrors.targetUserNotFound.message, {
            code: custodyDocumentErrors.targetUserNotFound.code,
          });
        }
        employeeName = user.displayName;
        employeeEmail = user.email;
      } else if (asset.assignedUserId) {
        employeeName = asset.assignedUserName;
        employeeEmail = asset.assignedUserEmail;
      } else {
        throw Boom.badRequest(custodyDocumentErrors.noTargetUser.message, {
          code: custodyDocumentErrors.noTargetUser.code,
        });
      }

      return renderCustodyDocumentPdf(
        {
          type: input.type,
          documentId: randomUUID().slice(0, 8),
          printDate: new Date(),
          handoverId: input.handoverId ?? null,
          assets: [toPdfAsset(asset)],
          employee: { name: employeeName, email: employeeEmail },
          conditionAtHandover: input.condition ?? null,
          accessoriesNote: input.accessoriesNote ?? null,
        },
        locale,
      );
    },

    /**
     * Multi-asset receipt: one PDF listing every selected asset in a grid.
     * Used by the bulk-assign wizard. Mirrors `generate`'s validation but for a
     * batch sharing a single target user, condition and accessories note.
     */
    async generateBatch(
      assetIds: string[],
      input: GenerateInput,
      locale: CustodyLocale = 'en',
    ): Promise<Buffer> {
      assertValidType(input.type);
      if (assetIds.length === 0) {
        throw Boom.badRequest(custodyDocumentErrors.invalidType.message, {
          code: custodyDocumentErrors.invalidType.code,
        });
      }

      const assets = await Promise.all(assetIds.map((id) => requireAsset(id)));

      let employeeName: string | null;
      let employeeEmail: string | null;

      if (input.type === ICustodyDocumentType.CHECK_IN) {
        // Every asset must be held by the same single user — that user is the employee.
        const owners = new Set(assets.map((a) => a.assignedUserId ?? ''));
        const allAssigned = assets.every((a) => a.status === IAssetStatus.ASSIGNED);
        if (!allAssigned || owners.size !== 1 || owners.has('')) {
          throw Boom.badRequest(custodyDocumentErrors.notAssigned.message, {
            code: custodyDocumentErrors.notAssigned.code,
          });
        }
        employeeName = assets[0].assignedUserName;
        employeeEmail = assets[0].assignedUserEmail;
      } else if (input.targetUserId) {
        const user = await userRepository.findById(input.targetUserId);
        if (!user) {
          throw Boom.notFound(custodyDocumentErrors.targetUserNotFound.message, {
            code: custodyDocumentErrors.targetUserNotFound.code,
          });
        }
        // Allow printing before assignment (STOCK) or after (already ASSIGNED to target).
        const eligible = assets.every(
          (a) =>
            a.status === IAssetStatus.STOCK ||
            a.status === IAssetStatus.MAINTENANCE ||
            (a.status === IAssetStatus.ASSIGNED && a.assignedUserId === input.targetUserId),
        );
        if (!eligible) {
          throw Boom.badRequest(custodyDocumentErrors.noTargetUser.message, {
            code: custodyDocumentErrors.noTargetUser.code,
          });
        }
        employeeName = user.displayName;
        employeeEmail = user.email;
      } else {
        throw Boom.badRequest(custodyDocumentErrors.noTargetUser.message, {
          code: custodyDocumentErrors.noTargetUser.code,
        });
      }

      return renderCustodyDocumentPdf(
        {
          type: input.type,
          documentId: randomUUID().slice(0, 8),
          printDate: new Date(),
          handoverId: input.handoverId ?? null,
          assets: assets.map(toPdfAsset),
          employee: { name: employeeName, email: employeeEmail },
          conditionAtHandover: input.condition ?? null,
          accessoriesNote: input.accessoriesNote ?? null,
        },
        locale,
      );
    },
  };
}

export default custodyDocumentDomainFactory;
