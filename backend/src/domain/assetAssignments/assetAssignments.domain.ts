import { IAssetStatus, IAssetWithAssignee, IUpdateAsset } from '@domain/_interfaces/asset.interface';
import { IHandoverType } from '@domain/_interfaces/handover.interface';
import Boom from '@hapi/boom';
import assetAssignmentErrors from './assetAssignments.errors';

export type BulkAssignType = 'CHECK_OUT' | 'CHECK_IN';
export type BulkAssignMode = 'direct' | 'verify';

interface Requester {
  id: string;
  role: string;
}

export interface BulkAssignInput {
  type: BulkAssignType;
  /** `verify` is only valid for CHECK_OUT (creates one magic-link handover per asset). */
  mode: BulkAssignMode;
  targetUserId: string;
  assetIds: string[];
}

export interface BulkAssignResult {
  succeeded: { assetId: string }[];
  failed: { assetId: string; code: string; message: string }[];
}

/** The slice of the asset domain the bulk flow reuses (Policy A block + audit). */
export interface AssetDomainPort {
  getAssetDetails(id: string): Promise<IAssetWithAssignee>;
  updateAsset(actor: Requester, id: string, payload: IUpdateAsset): Promise<IAssetWithAssignee>;
}

/** The slice of the handover domain the verify flow reuses. */
export interface HandoverDomainPort {
  createHandover(
    actor: Requester,
    assetId: string,
    input: { type: IHandoverType; targetUserId: string; sendEmail?: boolean },
  ): Promise<unknown>;
}

interface AssetAssignmentDeps {
  /** Wired WITH the handover-block repository so direct changes honour Policy A. */
  assetDomain: AssetDomainPort;
  handoverDomain: HandoverDomainPort;
}

/** Maps any thrown error into the per-asset { code, message } shape for the report. */
function describeFailure(error: unknown): { code: string; message: string } {
  if (error && typeof error === 'object') {
    const e = error as { data?: { code?: string }; message?: string };
    return { code: e.data?.code ?? 'GRR000X', message: e.message ?? 'Unknown error' };
  }
  return { code: 'GRR000X', message: 'Unknown error' };
}

function assetAssignmentDomainFactory(deps: AssetAssignmentDeps) {
  const { assetDomain, handoverDomain } = deps;

  /** Applies a single asset's checkout/return, reusing the centralized asset/handover logic. */
  async function applyOne(actor: Requester, input: BulkAssignInput, assetId: string): Promise<void> {
    if (input.type === 'CHECK_OUT') {
      if (input.mode === 'verify') {
        // createHandover validates STOCK + no open handover + active target user.
        await handoverDomain.createHandover(actor, assetId, {
          type: IHandoverType.CHECK_OUT,
          targetUserId: input.targetUserId,
          sendEmail: true,
        });
        return;
      }
      // Direct: only available inventory (STOCK / MAINTENANCE) may be checked out.
      const asset = await assetDomain.getAssetDetails(assetId);
      if (asset.status !== IAssetStatus.STOCK && asset.status !== IAssetStatus.MAINTENANCE) {
        throw Boom.conflict(assetAssignmentErrors.notEligibleForCheckout.message, {
          code: assetAssignmentErrors.notEligibleForCheckout.code,
        });
      }
      await assetDomain.updateAsset(actor, assetId, {
        status: IAssetStatus.ASSIGNED,
        assignedUserId: input.targetUserId,
      });
      return;
    }

    // CHECK_IN (return): the asset must currently be held by the chosen user.
    const asset = await assetDomain.getAssetDetails(assetId);
    if (asset.status !== IAssetStatus.ASSIGNED || asset.assignedUserId !== input.targetUserId) {
      throw Boom.conflict(assetAssignmentErrors.notEligibleForReturn.message, {
        code: assetAssignmentErrors.notEligibleForReturn.code,
      });
    }
    await assetDomain.updateAsset(actor, assetId, {
      status: IAssetStatus.STOCK,
      assignedUserId: null,
    });
  }

  return {
    /**
     * Bulk checkout/return. Each asset is processed independently so a partial
     * failure (e.g. one asset has an open handover) does not roll back the rest;
     * the report lists succeeded and failed ids with reasons.
     */
    async bulkAssign(actor: Requester, input: BulkAssignInput): Promise<BulkAssignResult> {
      if (input.type === 'CHECK_IN' && input.mode === 'verify') {
        throw Boom.badRequest(assetAssignmentErrors.verifyOnlyForCheckout.message, {
          code: assetAssignmentErrors.verifyOnlyForCheckout.code,
        });
      }

      const succeeded: { assetId: string }[] = [];
      const failed: { assetId: string; code: string; message: string }[] = [];

      for (const assetId of input.assetIds) {
        try {
          await applyOne(actor, input, assetId);
          succeeded.push({ assetId });
        } catch (error) {
          failed.push({ assetId, ...describeFailure(error) });
        }
      }

      return { succeeded, failed };
    },
  };
}

export type AssetAssignmentDomain = ReturnType<typeof assetAssignmentDomainFactory>;
export default assetAssignmentDomainFactory;
