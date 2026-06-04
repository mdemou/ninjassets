import {
  IAssetMapMarker,
  IAssetStatus,
  IAssetWithAssignee,
  ICreateAsset,
  IDepreciationMethod,
  IListAssetsResult,
  IUpdateAsset,
} from '@domain/_interfaces/asset.interface';
import { ICreateTransaction, ITransactionAction } from '@domain/_interfaces/transaction.interface';
import { AssetRepository } from '@domain/_repositories/asset.repository';
import { CategoryRepository } from '@domain/_repositories/category.repository';
import { HandoverRepository } from '@domain/_repositories/handover.repository';
import { ManufacturerRepository } from '@domain/_repositories/manufacturer.repository';
import { SiteRepository } from '@domain/_repositories/site.repository';
import { TransactionRepository } from '@domain/_repositories/transaction.repository';
import { UserRepository } from '@domain/_repositories/user.repository';
import { VendorRepository } from '@domain/_repositories/vendor.repository';
import config from '@config/config';
import Boom from '@hapi/boom';
import { assetImageStorage } from '@services/uploadedImage.service';
import logger from '@services/logger.service';
import notificationService from '@services/notifications/notificationService';
import { publishEventFromTransaction } from '@services/events/publishFromTransaction';
import assetErrors from './assets.errors';
import { validateCustomFields } from '@domain/categories/categoryFields.util';
import { ICategoryWithFields } from '@domain/_interfaces/category.interface';

interface AssetRepositories {
  assetRepository: AssetRepository;
  userRepository: UserRepository;
  siteRepository: SiteRepository;
  transactionRepository: TransactionRepository;
  manufacturerRepository: ManufacturerRepository;
  vendorRepository: VendorRepository;
  categoryRepository: CategoryRepository;
  /**
   * Optional: when provided, direct status/assignment changes are blocked while an
   * open handover exists (policy A). Only the admin PATCH path injects this; the
   * handover flow itself consumes the handover before applying its asset change.
   */
  handoverRepository?: HandoverRepository;
}

/** Identity of the caller, derived from the JWT credentials. */
interface Requester {
  id: string;
  role: string;
}

interface ListAssetsInput {
  search?: string;
  page?: number;
  siteId?: string;
  status?: IAssetStatus;
  manufacturerId?: string;
  vendorId?: string;
  categoryId?: string;
  eligibleParent?: boolean;
  eligibleChild?: boolean;
  excludeId?: string;
}

function throwAssetBadRequest(message: string): never {
  const { message: errorMessage, code } = assetErrors.badRequest(message);
  throw Boom.badRequest(errorMessage, { code });
}

async function countAssetChildren(repo: AssetRepository, assetId: string): Promise<number> {
  return repo.countChildren(assetId);
}

function assetDomainFactory(repositories: AssetRepositories) {
  const {
    assetRepository,
    userRepository,
    siteRepository,
    transactionRepository,
    manufacturerRepository,
    vendorRepository,
    categoryRepository,
    handoverRepository,
  } = repositories;

  /**
   * Loads a category with its field schema, or null when none is linked.
   * Throws when a non-null categoryId does not resolve.
   */
  async function resolveCategory(
    categoryId: string | null | undefined,
  ): Promise<ICategoryWithFields | null> {
    if (!categoryId) return null;
    const category = await categoryRepository.findById(categoryId);
    if (!category) {
      throw Boom.badRequest(assetErrors.categoryNotFound.message, {
        code: assetErrors.categoryNotFound.code,
      });
    }
    return category;
  }

  /** Validates that a linked site exists (when one is provided). */
  async function assertSiteExists(siteId: string | null | undefined): Promise<void> {
    if (!siteId) return;
    const site = await siteRepository.findById(siteId);
    if (!site) {
      throw Boom.badRequest(assetErrors.siteNotFound.message, {
        code: assetErrors.siteNotFound.code,
      });
    }
  }

  /**
   * Resolves the final { status, assignedUserId } pair, enforcing the lifecycle
   * rule: an asset may only have an owner while ASSIGNED, and an ASSIGNED asset
   * must have one. Mirrors the UI reactivity rule so orphan data cannot be
   * persisted even if the client misbehaves. Verifies the assignee exists.
   */
  async function resolveAssignment(
    status: IAssetStatus,
    assignedUserId: string | null | undefined,
  ): Promise<string | null> {
    if (status !== IAssetStatus.ASSIGNED) {
      // Any non-ASSIGNED status wipes the owner to prevent orphan assignments.
      return null;
    }

    if (!assignedUserId) {
      throw Boom.badRequest(assetErrors.assignedUserRequired.message, {
        code: assetErrors.assignedUserRequired.code,
      });
    }

    const user = await userRepository.findById(assignedUserId);
    if (!user) {
      throw Boom.badRequest(assetErrors.assignedUserNotFound.message, {
        code: assetErrors.assignedUserNotFound.code,
      });
    }

    return assignedUserId;
  }

  async function assertSerialAvailable(serialNumber: string, ignoreId?: string): Promise<void> {
    const existing = await assetRepository.findBySerialNumber(serialNumber);
    if (existing && existing.id !== ignoreId) {
      throw Boom.conflict(assetErrors.serialAlreadyExists.message, {
        code: assetErrors.serialAlreadyExists.code,
      });
    }
  }

  async function assertManufacturerExists(manufacturerId: string | null | undefined): Promise<void> {
    if (!manufacturerId) return;
    const row = await manufacturerRepository.findById(manufacturerId);
    if (!row) {
      throw Boom.badRequest(assetErrors.manufacturerNotFound.message, {
        code: assetErrors.manufacturerNotFound.code,
      });
    }
  }

  async function assertVendorExists(vendorId: string | null | undefined): Promise<void> {
    if (!vendorId) return;
    const row = await vendorRepository.findById(vendorId);
    if (!row) {
      throw Boom.badRequest(assetErrors.vendorNotFound.message, {
        code: assetErrors.vendorNotFound.code,
      });
    }
  }

  async function assertParentAssetValid(
    parentAssetId: string | null | undefined,
    assetId?: string,
  ): Promise<void> {
    if (!parentAssetId) return;
    if (assetId && parentAssetId === assetId) {
      throwAssetBadRequest('An asset cannot be its own parent');
    }
    const parent = await assetRepository.findById(parentAssetId);
    if (!parent) {
      throw Boom.badRequest(assetErrors.parentNotFound.message, {
        code: assetErrors.parentNotFound.code,
      });
    }
    if (parent.parentAssetId) {
      throwAssetBadRequest('Parent must be a top-level asset (not a component)');
    }
    if (assetId) {
      const childCount = await countAssetChildren(assetRepository, assetId);
      if (childCount > 0) {
        throwAssetBadRequest('An asset with components cannot become a child');
      }
    }
  }

  function validateFinancialFields(data: {
    purchaseCost?: number | null;
    purchaseDate?: string | null;
    usefulLifeMonths?: number | null;
    depreciationMethod?: IDepreciationMethod | null;
    salvageValue?: number | null;
  }): void {
    const hasAny =
      data.purchaseCost != null ||
      data.purchaseDate != null ||
      data.usefulLifeMonths != null ||
      data.depreciationMethod != null ||
      data.salvageValue != null;

    if (!hasAny) return;

    if (data.purchaseCost != null) {
      if (data.purchaseCost < 0) {
        throwAssetBadRequest('purchaseCost must be non-negative');
      }
      if (!data.purchaseDate || !data.usefulLifeMonths || !data.depreciationMethod) {
        throwAssetBadRequest(
          'purchaseDate, usefulLifeMonths, and depreciationMethod are required when purchaseCost is set',
        );
      }
    }

    if (data.usefulLifeMonths != null && data.usefulLifeMonths <= 0) {
      throwAssetBadRequest('usefulLifeMonths must be positive');
    }

    if (
      data.salvageValue != null &&
      data.purchaseCost != null &&
      data.salvageValue > data.purchaseCost
    ) {
      throwAssetBadRequest('salvageValue cannot exceed purchaseCost');
    }
  }

  function pickAssetFields(payload: ICreateAsset | IUpdateAsset): Partial<IUpdateAsset> {
    const out: Partial<IUpdateAsset> = {};
    if ('manufacturerId' in payload && payload.manufacturerId !== undefined) {
      out.manufacturerId = payload.manufacturerId;
    }
    if ('vendorId' in payload && payload.vendorId !== undefined) {
      out.vendorId = payload.vendorId;
    }
    if ('parentAssetId' in payload && payload.parentAssetId !== undefined) {
      out.parentAssetId = payload.parentAssetId;
    }
    if ('categoryId' in payload && payload.categoryId !== undefined) {
      out.categoryId = payload.categoryId;
    }
    if ('purchaseDate' in payload && payload.purchaseDate !== undefined) {
      out.purchaseDate = payload.purchaseDate;
    }
    if ('purchaseCost' in payload && payload.purchaseCost !== undefined) {
      out.purchaseCost = payload.purchaseCost;
    }
    if ('salvageValue' in payload && payload.salvageValue !== undefined) {
      out.salvageValue = payload.salvageValue;
    }
    if ('usefulLifeMonths' in payload && payload.usefulLifeMonths !== undefined) {
      out.usefulLifeMonths = payload.usefulLifeMonths;
    }
    if ('depreciationMethod' in payload && payload.depreciationMethod !== undefined) {
      out.depreciationMethod = payload.depreciationMethod;
    }
    if ('warrantyEndDate' in payload && payload.warrantyEndDate !== undefined) {
      out.warrantyEndDate = payload.warrantyEndDate;
    }
    if ('expectedReturnDate' in payload && payload.expectedReturnDate !== undefined) {
      out.expectedReturnDate = payload.expectedReturnDate;
    }
    return out;
  }

  /** Writes audit-log rows. Best-effort: a failure here never fails the mutation. */
  async function recordEvents(events: ICreateTransaction[]): Promise<void> {
    if (events.length === 0) return;
    try {
      await transactionRepository.createMany(events);
    } catch (error) {
      logger.error(__filename, 'recordEvents', 'Failed to record asset history', error);
    }
    // Fan out to the domain event bus (webhooks). Independent of the audit write.
    for (const event of events) publishEventFromTransaction(event);
  }

  async function actorNameOf(actorId: string): Promise<string | null> {
    const actor = await userRepository.findById(actorId);
    return actor?.displayName ?? null;
  }

  return {
    /** Admin view: every asset. */
    async listAssets(input: ListAssetsInput): Promise<IListAssetsResult> {
      const page = Math.max(1, input.page ?? 1);
      const { assets, total } = await assetRepository.list({
        search: input.search?.trim() || undefined,
        page,
        siteId: input.siteId,
        status: input.status,
        manufacturerId: input.manufacturerId,
        vendorId: input.vendorId,
        categoryId: input.categoryId,
        eligibleParent: input.eligibleParent,
        eligibleChild: input.eligibleChild,
        excludeId: input.excludeId,
      });
      return { assets, total, page, pageSize: config.pagination.pageSize };
    },

    /**
     * Map markers for the admin dashboard: every asset that resolves to a
     * coordinate, in one query. Replaces paging the full asset list client-side.
     */
    async listMapMarkers(): Promise<IAssetMapMarker[]> {
      return assetRepository.listMapMarkers();
    },

    /** Personal view: only the assets assigned to the given user. */
    async listMyAssets(userId: string, input: ListAssetsInput): Promise<IListAssetsResult> {
      const page = Math.max(1, input.page ?? 1);
      const { assets, total } = await assetRepository.list({
        search: input.search?.trim() || undefined,
        page,
        assignedUserId: userId,
        assigneeList: true,
      });
      return { assets, total, page, pageSize: config.pagination.pageSize };
    },

    /** Admin view: assets linked to the given site. */
    async listSiteAssets(siteId: string, input: ListAssetsInput): Promise<IListAssetsResult> {
      const page = Math.max(1, input.page ?? 1);
      const { assets, total } = await assetRepository.list({
        search: input.search?.trim() || undefined,
        page,
        siteId,
      });
      return { assets, total, page, pageSize: config.pagination.pageSize };
    },

    async getAssetDetails(id: string): Promise<IAssetWithAssignee> {
      const asset = await assetRepository.findById(id);
      if (!asset) {
        throw Boom.notFound(assetErrors.assetNotFound.message, {
          code: assetErrors.assetNotFound.code,
        });
      }
      return asset;
    },

    async createAsset(actor: Requester, payload: ICreateAsset): Promise<IAssetWithAssignee> {
      await assertSerialAvailable(payload.serialNumber);
      await assertSiteExists(payload.siteId);
      await assertManufacturerExists(payload.manufacturerId);
      await assertVendorExists(payload.vendorId);
      validateFinancialFields(payload);
      await assertParentAssetValid(payload.parentAssetId);

      const category = await resolveCategory(payload.categoryId);
      const customFields = validateCustomFields(category?.fields ?? null, payload.customFields, {
        dropUnknown: false,
      });

      const status = payload.status ?? IAssetStatus.STOCK;
      const assignedUserId = await resolveAssignment(status, payload.assignedUserId);

      const created = await assetRepository.create({
        name: payload.name,
        model: payload.model ?? '',
        serialNumber: payload.serialNumber,
        status,
        assignedUserId,
        siteId: payload.siteId ?? null,
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
        note: payload.note ?? null,
        manufacturerId: payload.manufacturerId ?? null,
        vendorId: payload.vendorId ?? null,
        parentAssetId: payload.parentAssetId ?? null,
        categoryId: payload.categoryId ?? null,
        customFields,
        purchaseDate: payload.purchaseDate ?? null,
        purchaseCost: payload.purchaseCost ?? null,
        salvageValue: payload.salvageValue ?? null,
        usefulLifeMonths: payload.usefulLifeMonths ?? null,
        depreciationMethod: payload.depreciationMethod ?? null,
        warrantyEndDate: payload.warrantyEndDate ?? null,
        expectedReturnDate: payload.expectedReturnDate ?? null,
      });

      const asset = await assetRepository.findById(created.id);
      if (!asset) {
        throw Boom.badImplementation('Asset created but could not be retrieved');
      }

      const actorName = await actorNameOf(actor.id);
      const base = { assetId: asset.id, assetName: asset.name, actorUserId: actor.id, actorName };
      const events: ICreateTransaction[] = [
        { ...base, action: ITransactionAction.CREATED, targetUserId: null, targetName: null, detail: null },
      ];
      // Created already assigned: emit a separate ASSIGNED so it shows in the
      // assignee's personal history.
      if (asset.assignedUserId) {
        events.push({
          ...base,
          action: ITransactionAction.ASSIGNED,
          targetUserId: asset.assignedUserId,
          targetName: asset.assignedUserName,
          detail: null,
        });
      }
      await recordEvents(events);

      return asset;
    },

    async updateAsset(
      actor: Requester,
      id: string,
      payload: IUpdateAsset,
      options?: { force?: boolean },
    ): Promise<IAssetWithAssignee> {
      const existing = await assetRepository.findById(id);
      if (!existing) {
        throw Boom.notFound(assetErrors.assetNotFound.message, {
          code: assetErrors.assetNotFound.code,
        });
      }

      if (payload.serialNumber !== undefined && payload.serialNumber !== existing.serialNumber) {
        await assertSerialAvailable(payload.serialNumber, id);
      }
      if (payload.siteId !== undefined) {
        await assertSiteExists(payload.siteId);
      }
      if (payload.manufacturerId !== undefined) {
        await assertManufacturerExists(payload.manufacturerId);
      }
      if (payload.vendorId !== undefined) {
        await assertVendorExists(payload.vendorId);
      }
      if (payload.parentAssetId !== undefined) {
        await assertParentAssetValid(payload.parentAssetId, id);
      }

      // Category + custom fields. Recompute whenever either is touched (changing
      // the category re-validates the values against the new schema and drops
      // any keys it no longer defines).
      const nextCategoryId =
        payload.categoryId !== undefined ? payload.categoryId : existing.categoryId;
      const categoryChanged = nextCategoryId !== existing.categoryId;
      let resolvedCustomFields: Record<string, unknown> | undefined;
      if (payload.customFields !== undefined || categoryChanged) {
        const category = await resolveCategory(nextCategoryId);
        // An explicit submit is strict; values carried across a category change
        // are sanitized (unknown keys dropped).
        const carrying = payload.customFields === undefined;
        const source = carrying ? existing.customFields : payload.customFields;
        resolvedCustomFields = validateCustomFields(category?.fields ?? null, source, {
          dropUnknown: carrying,
        });
      }

      const mergedFinancial = {
        purchaseCost: payload.purchaseCost ?? existing.purchaseCost,
        purchaseDate: payload.purchaseDate ?? existing.purchaseDate,
        usefulLifeMonths: payload.usefulLifeMonths ?? existing.usefulLifeMonths,
        depreciationMethod: payload.depreciationMethod ?? existing.depreciationMethod,
        salvageValue: payload.salvageValue ?? existing.salvageValue,
      };
      validateFinancialFields(mergedFinancial);

      // The resulting status drives the assignment rule. If the caller supplied
      // an assignedUserId we use it; otherwise fall back to the current owner.
      const nextStatus = payload.status ?? existing.status;
      const nextAssignedUserId =
        payload.assignedUserId !== undefined ? payload.assignedUserId : existing.assignedUserId;

      // Policy A: an open handover owns the asset's custody state. Block direct
      // changes to status/assignee until it is resolved (accept/cancel/complete).
      // A bulk import job may pass `force` to apply the admin override (SPEC-IMPORT-001 §7.3).
      const changesCustody =
        nextStatus !== existing.status || nextAssignedUserId !== existing.assignedUserId;
      if (changesCustody && handoverRepository && !options?.force) {
        const open = await handoverRepository.findOpenByAssetId(id);
        if (open && new Date(open.expiresAt) > new Date()) {
          throw Boom.conflict(assetErrors.openHandoverBlocks.message, {
            code: assetErrors.openHandoverBlocks.code,
          });
        }
      }

      const assignedUserId = await resolveAssignment(nextStatus, nextAssignedUserId);

      const updateData: IUpdateAsset = { assignedUserId, status: nextStatus };
      if (payload.name !== undefined) updateData.name = payload.name;
      if (payload.model !== undefined) updateData.model = payload.model;
      if (payload.serialNumber !== undefined) updateData.serialNumber = payload.serialNumber;
      if (payload.siteId !== undefined) updateData.siteId = payload.siteId;
      if (payload.latitude !== undefined) updateData.latitude = payload.latitude;
      if (payload.longitude !== undefined) updateData.longitude = payload.longitude;
      if (payload.note !== undefined) updateData.note = payload.note;
      Object.assign(updateData, pickAssetFields(payload));
      if (resolvedCustomFields !== undefined) updateData.customFields = resolvedCustomFields;

      await assetRepository.update(id, updateData);

      const asset = await assetRepository.findById(id);
      if (!asset) {
        throw Boom.badImplementation('Asset updated but could not be retrieved');
      }

      await recordEvents(await deriveUpdateEvents(actor, existing, asset));

      await notifyFormerAssigneeIfUnassigned(actor, existing, asset);

      return asset;
    },

    async deleteAsset(actor: Requester, id: string): Promise<void> {
      const existing = await assetRepository.findById(id);
      if (!existing) {
        throw Boom.notFound(assetErrors.assetNotFound.message, {
          code: assetErrors.assetNotFound.code,
        });
      }
      await assetRepository.delete(id);
      await assetImageStorage.remove(existing.imageFilename);

      const actorName = await actorNameOf(actor.id);
      await recordEvents([
        {
          action: ITransactionAction.DELETED,
          // The asset row is gone; keep only the name snapshot.
          assetId: null,
          assetName: existing.name,
          actorUserId: actor.id,
          actorName,
          targetUserId: existing.assignedUserId,
          targetName: existing.assignedUserName,
          detail: null,
        },
      ]);
    },
  };

  /**
   * Emails the previous assignee when custody is removed by someone else (e.g. admin
   * direct unassign or reassignment). Skips when the former assignee is the actor
   * (verified CHECK_IN accept).
   */
  async function notifyFormerAssigneeIfUnassigned(
    actor: Requester,
    before: IAssetWithAssignee,
    after: IAssetWithAssignee,
  ): Promise<void> {
    const formerAssigneeId = before.assignedUserId;
    if (!formerAssigneeId || formerAssigneeId === after.assignedUserId) {
      return;
    }
    if (actor.id === formerAssigneeId) {
      return;
    }

    // Delivered via the notification queue. Asset name/serial are non-secret and
    // carried in the job; the recipient's email is re-fetched by userId in the consumer.
    await notificationService.email('email.asset_unassigned', {
      recipientUserId: formerAssigneeId,
      assetName: before.name,
      serialNumber: before.serialNumber,
    });
  }

  /** Diffs the before/after asset states into a list of audit events. */
  async function deriveUpdateEvents(
    actor: Requester,
    before: IAssetWithAssignee,
    after: IAssetWithAssignee,
  ): Promise<ICreateTransaction[]> {
    const actorName = await actorNameOf(actor.id);
    const base = { assetId: after.id, assetName: after.name, actorUserId: actor.id, actorName };
    // Whoever holds (or just held) the asset should see status/site/edit events.
    const holderId = after.assignedUserId ?? before.assignedUserId;
    const holderName = after.assignedUserName ?? before.assignedUserName;
    const events: ICreateTransaction[] = [];

    if (before.assignedUserId !== after.assignedUserId) {
      if (before.assignedUserId) {
        events.push({
          ...base,
          action: ITransactionAction.UNASSIGNED,
          targetUserId: before.assignedUserId,
          targetName: before.assignedUserName,
          detail: null,
        });
      }
      if (after.assignedUserId) {
        events.push({
          ...base,
          action: ITransactionAction.ASSIGNED,
          targetUserId: after.assignedUserId,
          targetName: after.assignedUserName,
          detail: null,
        });
      }
    }

    if (before.status !== after.status) {
      events.push({
        ...base,
        action: ITransactionAction.STATUS_CHANGED,
        targetUserId: holderId,
        targetName: holderName,
        detail: `${before.status} → ${after.status}`,
      });
    }

    if (before.siteId !== after.siteId) {
      events.push({
        ...base,
        action: ITransactionAction.SITE_CHANGED,
        targetUserId: holderId,
        targetName: holderName,
        detail: after.siteName ?? 'No site',
      });
    }

    if (before.manufacturerId !== after.manufacturerId) {
      events.push({
        ...base,
        action: ITransactionAction.MANUFACTURER_CHANGED,
        targetUserId: holderId,
        targetName: holderName,
        detail: after.manufacturerName ?? 'none',
      });
    }

    if (before.vendorId !== after.vendorId) {
      events.push({
        ...base,
        action: ITransactionAction.VENDOR_CHANGED,
        targetUserId: holderId,
        targetName: holderName,
        detail: after.vendorName ?? 'none',
      });
    }

    if (before.parentAssetId !== after.parentAssetId) {
      events.push({
        ...base,
        action: ITransactionAction.PARENT_CHANGED,
        targetUserId: holderId,
        targetName: holderName,
        detail: after.parentAssetName ?? 'none',
      });
    }

    if (before.categoryId !== after.categoryId) {
      events.push({
        ...base,
        action: ITransactionAction.CATEGORY_CHANGED,
        targetUserId: holderId,
        targetName: holderName,
        detail: after.categoryName ?? 'none',
      });
    } else if (
      JSON.stringify(before.customFields ?? {}) !== JSON.stringify(after.customFields ?? {})
    ) {
      // Custom-field edits within the same category get their own audit row.
      events.push({
        ...base,
        action: ITransactionAction.CUSTOM_FIELDS_CHANGED,
        targetUserId: holderId,
        targetName: holderName,
        detail: null,
      });
    }

    if (before.warrantyEndDate !== after.warrantyEndDate) {
      events.push({
        ...base,
        action: ITransactionAction.WARRANTY_CHANGED,
        targetUserId: holderId,
        targetName: holderName,
        detail: after.warrantyEndDate ?? 'none',
      });
    }

    if (before.expectedReturnDate !== after.expectedReturnDate) {
      events.push({
        ...base,
        action: ITransactionAction.RETURN_DATE_CHANGED,
        targetUserId: holderId,
        targetName: holderName,
        detail: after.expectedReturnDate ?? 'none',
      });
    }

    // Plain field edits (only worth a row when nothing more specific fired).
    const fieldsChanged =
      before.name !== after.name ||
      before.model !== after.model ||
      before.serialNumber !== after.serialNumber ||
      before.note !== after.note ||
      before.purchaseCost !== after.purchaseCost ||
      before.purchaseDate !== after.purchaseDate ||
      before.salvageValue !== after.salvageValue ||
      before.usefulLifeMonths !== after.usefulLifeMonths ||
      before.depreciationMethod !== after.depreciationMethod;
    if (fieldsChanged && events.length === 0) {
      events.push({
        ...base,
        action: ITransactionAction.UPDATED,
        targetUserId: holderId,
        targetName: holderName,
        detail: null,
      });
    }

    return events;
  }
}

export type AssetDomain = ReturnType<typeof assetDomainFactory>;

export default assetDomainFactory;
