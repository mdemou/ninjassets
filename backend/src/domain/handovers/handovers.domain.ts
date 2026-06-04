import config from '@config/config';
import { IAssetStatus, IAssetWithAssignee, IUpdateAsset } from '@domain/_interfaces/asset.interface';
import {
  IHandoverStatus,
  IHandoverType,
  IHandoverWithDetails,
  IListHandoversResult,
  IListPendingHandoversResult,
} from '@domain/_interfaces/handover.interface';
import { ICreateTransaction, ITransactionAction } from '@domain/_interfaces/transaction.interface';
import { IUserStatus } from '@domain/_interfaces/users.interface';
import { AssetRepository } from '@domain/_repositories/asset.repository';
import { HandoverRepository } from '@domain/_repositories/handover.repository';
import { TransactionRepository } from '@domain/_repositories/transaction.repository';
import { UserRepository } from '@domain/_repositories/user.repository';
import Boom from '@hapi/boom';
import cryptoService from '@services/crypto.service';
import emailService from '@services/email/email.service';
import {
  handoverCheckoutEmailHtml,
  handoverCheckoutEmailText,
  handoverReturnEmailHtml,
  handoverReturnEmailText,
} from '@services/email/templates/handover';
import logger from '@services/logger.service';
import { publishEventFromTransaction } from '@services/events/publishFromTransaction';
import handoverErrors from './handovers.errors';

/** The slice of the asset domain the handover flow reuses (resolveAssignment + audit). */
export interface AssetDomainPort {
  getAssetDetails(id: string): Promise<IAssetWithAssignee>;
  updateAsset(
    actor: { id: string; role: string },
    id: string,
    payload: IUpdateAsset,
  ): Promise<IAssetWithAssignee>;
}

interface HandoverRepositories {
  handoverRepository: HandoverRepository;
  assetRepository: AssetRepository;
  userRepository: UserRepository;
  transactionRepository: TransactionRepository;
  assetDomain: AssetDomainPort;
}

interface Requester {
  id: string;
  role: string;
}

interface CreateHandoverInput {
  type: IHandoverType;
  targetUserId: string;
  sendEmail?: boolean;
}

interface CreateHandoverResult {
  handover: IHandoverWithDetails;
  /** Present only when the admin opted out of email (copy-link / support flow). */
  acceptUrl?: string;
}

const LAST_N_HANDOVERS = 20;

function handoverDomainFactory(repositories: HandoverRepositories) {
  const { handoverRepository, assetRepository, userRepository, transactionRepository, assetDomain } =
    repositories;

  async function actorNameOf(actorId: string): Promise<string | null> {
    const actor = await userRepository.findById(actorId);
    return actor?.displayName ?? null;
  }

  /** Best-effort audit write — never fails the main flow. */
  async function recordEvent(event: ICreateTransaction): Promise<void> {
    try {
      await transactionRepository.createMany([event]);
    } catch (error) {
      logger.error(__filename, 'recordEvent', 'Failed to record handover history', error);
    }
    // Fan out to the domain event bus (webhooks). Independent of the audit write.
    publishEventFromTransaction(event);
  }

  function acceptUrlFor(token: string): string {
    return `${config.frontendUrl}/handover/accept?token=${token}`;
  }

  function isExpired(expiresAt: string): boolean {
    return new Date(expiresAt) <= new Date();
  }

  /**
   * Ensures no live OPEN handover blocks a new one. A stale (expired) OPEN row is
   * lazily transitioned to EXPIRED so it frees the partial-unique slot.
   */
  async function assertNoBlockingOpenHandover(assetId: string): Promise<void> {
    const open = await handoverRepository.findOpenByAssetId(assetId);
    if (!open) return;
    if (isExpired(open.expiresAt)) {
      await handoverRepository.expire(open.id);
      return;
    }
    throw Boom.conflict(handoverErrors.openHandoverExists.message, {
      code: handoverErrors.openHandoverExists.code,
    });
  }

  async function loadHandoverByToken(token: string): Promise<IHandoverWithDetails> {
    const tokenHash = cryptoService.sha256Hex(token);
    const handover = await handoverRepository.findByTokenHash(tokenHash);
    if (!handover) {
      throw Boom.badRequest(handoverErrors.invalidToken.message, {
        code: handoverErrors.invalidToken.code,
      });
    }
    if (handover.status === IHandoverStatus.CONSUMED || handover.status === IHandoverStatus.CANCELLED) {
      throw Boom.badRequest(handoverErrors.tokenAlreadyUsed.message, {
        code: handoverErrors.tokenAlreadyUsed.code,
      });
    }
    if (handover.status === IHandoverStatus.EXPIRED || isExpired(handover.expiresAt)) {
      // Lazily flip a stale OPEN row so the slot is freed for a future handover.
      if (handover.status === IHandoverStatus.OPEN) {
        await handoverRepository.expire(handover.id);
      }
      throw Boom.badRequest(handoverErrors.tokenExpired.message, {
        code: handoverErrors.tokenExpired.code,
      });
    }
    return handover;
  }

  async function loadOpenHandoverForRecipient(
    handoverId: string,
    callerId: string,
  ): Promise<IHandoverWithDetails> {
    const handover = await handoverRepository.findById(handoverId);
    if (!handover || handover.targetUserId !== callerId) {
      throw Boom.notFound(handoverErrors.handoverNotFound.message, {
        code: handoverErrors.handoverNotFound.code,
      });
    }
    if (handover.status === IHandoverStatus.CONSUMED || handover.status === IHandoverStatus.CANCELLED) {
      throw Boom.badRequest(handoverErrors.tokenAlreadyUsed.message, {
        code: handoverErrors.tokenAlreadyUsed.code,
      });
    }
    if (handover.status === IHandoverStatus.EXPIRED || isExpired(handover.expiresAt)) {
      if (handover.status === IHandoverStatus.OPEN) {
        await handoverRepository.expire(handover.id);
      }
      throw Boom.badRequest(handoverErrors.tokenExpired.message, {
        code: handoverErrors.tokenExpired.code,
      });
    }
    return handover;
  }

  async function consumeHandoverAsRecipient(
    caller: Requester,
    handover: IHandoverWithDetails,
  ): Promise<IAssetWithAssignee> {
    if (handover.targetUserId !== caller.id) {
      throw Boom.forbidden(handoverErrors.wrongRecipient.message, {
        code: handoverErrors.wrongRecipient.code,
      });
    }
    await assertCheckinStillValid(handover);

    const consumed = await handoverRepository.consume(handover.id, caller.id);
    if (!consumed) {
      throw Boom.badRequest(handoverErrors.tokenAlreadyUsed.message, {
        code: handoverErrors.tokenAlreadyUsed.code,
      });
    }

    const asset = await applyAssetChange(caller, handover);

    const actorName = await actorNameOf(caller.id);
    await recordEvent({
      action: ITransactionAction.CUSTODY_ACCEPTED,
      assetId: handover.assetId,
      assetName: handover.assetName,
      actorUserId: caller.id,
      actorName,
      targetUserId: handover.targetUserId,
      targetName: handover.targetUserName,
      detail: handover.type,
    });

    return asset;
  }

  /**
   * Applies the asset state change for a consumed handover, reusing the asset
   * domain so resolveAssignment + deriveUpdateEvents stay the single source of
   * truth (emits ASSIGNED / UNASSIGNED / STATUS_CHANGED). The handover must
   * already be consumed so the direct-assign block does not fire.
   */
  async function applyAssetChange(
    actor: Requester,
    handover: IHandoverWithDetails,
  ): Promise<IAssetWithAssignee> {
    if (handover.type === IHandoverType.CHECK_OUT) {
      return assetDomain.updateAsset(actor, handover.assetId, {
        status: IAssetStatus.ASSIGNED,
        assignedUserId: handover.targetUserId,
      });
    }
    return assetDomain.updateAsset(actor, handover.assetId, {
      status: IAssetStatus.STOCK,
      assignedUserId: null,
    });
  }

  /** Re-validates a CHECK_IN target against the live assignee right before applying. */
  async function assertCheckinStillValid(handover: IHandoverWithDetails): Promise<void> {
    if (handover.type !== IHandoverType.CHECK_IN) return;
    const asset = await assetRepository.findById(handover.assetId);
    if (!asset || asset.assignedUserId !== handover.targetUserId) {
      throw Boom.conflict(handoverErrors.assigneeChanged.message, {
        code: handoverErrors.assigneeChanged.code,
      });
    }
  }

  return {
    /** Admin: start a verified handover and (optionally) email the target user. */
    async createHandover(actor: Requester, assetId: string, input: CreateHandoverInput): Promise<CreateHandoverResult> {
      const asset = await assetRepository.findById(assetId);
      if (!asset) {
        throw Boom.notFound(handoverErrors.assetNotFound.message, {
          code: handoverErrors.assetNotFound.code,
        });
      }

      const targetUser = await userRepository.findById(input.targetUserId);
      if (!targetUser) {
        throw Boom.badRequest(handoverErrors.targetUserNotFound.message, {
          code: handoverErrors.targetUserNotFound.code,
        });
      }
      if (targetUser.status !== IUserStatus.ACTIVE) {
        throw Boom.badRequest(handoverErrors.targetUserInactive.message, {
          code: handoverErrors.targetUserInactive.code,
        });
      }

      if (input.type === IHandoverType.CHECK_OUT) {
        if (asset.status !== IAssetStatus.STOCK) {
          throw Boom.badRequest(handoverErrors.invalidStatusForCheckout.message, {
            code: handoverErrors.invalidStatusForCheckout.code,
          });
        }
      } else {
        if (asset.status !== IAssetStatus.ASSIGNED) {
          throw Boom.badRequest(handoverErrors.invalidStatusForCheckin.message, {
            code: handoverErrors.invalidStatusForCheckin.code,
          });
        }
        if (asset.assignedUserId !== input.targetUserId) {
          throw Boom.badRequest(handoverErrors.checkinTargetMismatch.message, {
            code: handoverErrors.checkinTargetMismatch.code,
          });
        }
      }

      await assertNoBlockingOpenHandover(assetId);

      const token = cryptoService.generateToken();
      const tokenHash = cryptoService.sha256Hex(token);
      const expiresAt = new Date(Date.now() + config.tokenExpiry.handoverHours * 60 * 60 * 1000);

      const created = await handoverRepository.create({
        assetId,
        type: input.type,
        targetUserId: input.targetUserId,
        createdByUserId: actor.id,
        tokenHash,
        expiresAt,
      });

      const detail = await handoverRepository.findById(created.id);
      if (!detail) {
        throw Boom.badImplementation('Handover created but could not be retrieved');
      }

      const actorName = await actorNameOf(actor.id);
      await recordEvent({
        action: ITransactionAction.HANDOVER_CREATED,
        assetId: asset.id,
        assetName: asset.name,
        actorUserId: actor.id,
        actorName,
        targetUserId: input.targetUserId,
        targetName: targetUser.displayName,
        detail: input.type,
      });

      // NOTE: unlike the other transactional emails (which now flow through the
      // notification queue), the handover email stays inline. It embeds the raw
      // magic-link token, which is stored hash-only and is unrecoverable later —
      // so a reference-based consumer could not re-render it (SPEC-WEBHOOK-001 §7).
      const sendEmail = input.sendEmail !== false;
      if (sendEmail) {
        const params = {
          token,
          recipientName: targetUser.displayName,
          assetName: asset.name,
          serialNumber: asset.serialNumber,
        };
        try {
          await emailService.sendMail({
            to: targetUser.email,
            subject:
              input.type === IHandoverType.CHECK_OUT
                ? 'Confirm you are receiving an asset'
                : 'Confirm return of an asset',
            html:
              input.type === IHandoverType.CHECK_OUT
                ? handoverCheckoutEmailHtml(params)
                : handoverReturnEmailHtml(params),
            text:
              input.type === IHandoverType.CHECK_OUT
                ? handoverCheckoutEmailText(params)
                : handoverReturnEmailText(params),
          });
        } catch (error) {
          logger.error(__filename, 'createHandover', 'Failed to send handover email', error);
        }
        return { handover: detail };
      }

      // Copy-link / support flow: surface the URL to the (trusted) admin instead of emailing.
      return { handover: detail, acceptUrl: acceptUrlFor(token) };
    },

    /** User: list open, non-expired handovers awaiting this user's confirmation. */
    async listPendingForUser(caller: Requester): Promise<IListPendingHandoversResult> {
      const handovers = await handoverRepository.listOpenByTargetUserId(caller.id, LAST_N_HANDOVERS);
      return { handovers, total: handovers.length };
    },

    /** Admin: list open, non-expired handovers (dashboard overview). */
    async listOpenHandovers(): Promise<IListHandoversResult> {
      const handovers = await handoverRepository.listAllOpen(LAST_N_HANDOVERS);
      return { handovers, total: handovers.length };
    },

    /** Admin: list recent handovers for an asset. */
    async listForAsset(assetId: string): Promise<IListHandoversResult> {
      const asset = await assetRepository.findById(assetId);
      if (!asset) {
        throw Boom.notFound(handoverErrors.assetNotFound.message, {
          code: handoverErrors.assetNotFound.code,
        });
      }
      const handovers = await handoverRepository.listByAssetId(assetId, LAST_N_HANDOVERS);
      return { handovers, total: handovers.length };
    },

    /** Admin: get a single handover (no raw token). */
    async getHandover(handoverId: string): Promise<IHandoverWithDetails> {
      const handover = await handoverRepository.findById(handoverId);
      if (!handover) {
        throw Boom.notFound(handoverErrors.handoverNotFound.message, {
          code: handoverErrors.handoverNotFound.code,
        });
      }
      return handover;
    },

    /** Admin: cancel an open handover (no asset change). */
    async cancelHandover(actor: Requester, handoverId: string): Promise<IHandoverWithDetails> {
      const handover = await handoverRepository.findById(handoverId);
      if (!handover) {
        throw Boom.notFound(handoverErrors.handoverNotFound.message, {
          code: handoverErrors.handoverNotFound.code,
        });
      }
      const cancelled = await handoverRepository.cancel(handoverId, actor.id);
      if (!cancelled) {
        // Was not OPEN (already consumed/cancelled/expired).
        throw Boom.badRequest(handoverErrors.tokenAlreadyUsed.message, {
          code: handoverErrors.tokenAlreadyUsed.code,
        });
      }

      const actorName = await actorNameOf(actor.id);
      await recordEvent({
        action: ITransactionAction.HANDOVER_CANCELLED,
        assetId: handover.assetId,
        assetName: handover.assetName,
        actorUserId: actor.id,
        actorName,
        targetUserId: handover.targetUserId,
        targetName: handover.targetUserName,
        detail: handover.type,
      });

      const updated = await handoverRepository.findById(handoverId);
      return updated ?? handover;
    },

    /** Admin: complete a handover on behalf of the target user. */
    async completeOnBehalf(actor: Requester, handoverId: string): Promise<IAssetWithAssignee> {
      const handover = await handoverRepository.findById(handoverId);
      if (!handover) {
        throw Boom.notFound(handoverErrors.handoverNotFound.message, {
          code: handoverErrors.handoverNotFound.code,
        });
      }
      if (handover.status !== IHandoverStatus.OPEN || isExpired(handover.expiresAt)) {
        if (handover.status === IHandoverStatus.OPEN) await handoverRepository.expire(handover.id);
        throw Boom.badRequest(handoverErrors.tokenAlreadyUsed.message, {
          code: handoverErrors.tokenAlreadyUsed.code,
        });
      }
      await assertCheckinStillValid(handover);

      const consumed = await handoverRepository.consume(handoverId, actor.id);
      if (!consumed) {
        throw Boom.badRequest(handoverErrors.tokenAlreadyUsed.message, {
          code: handoverErrors.tokenAlreadyUsed.code,
        });
      }

      // Asset change is attributed to the admin acting on behalf.
      const asset = await applyAssetChange(actor, handover);

      const actorName = await actorNameOf(actor.id);
      await recordEvent({
        action: ITransactionAction.CUSTODY_COMPLETED_ON_BEHALF,
        assetId: handover.assetId,
        assetName: handover.assetName,
        actorUserId: actor.id,
        actorName,
        targetUserId: handover.targetUserId,
        targetName: handover.targetUserName,
        detail: handover.type,
      });

      return asset;
    },

    /** User: preview a handover by token (requires auth; only the intended recipient). */
    async preview(caller: Requester, token: string): Promise<IHandoverWithDetails> {
      const handover = await loadHandoverByToken(token);
      if (handover.targetUserId !== caller.id) {
        throw Boom.forbidden(handoverErrors.wrongRecipient.message, {
          code: handoverErrors.wrongRecipient.code,
        });
      }
      return handover;
    },

    /** User: accept (consume) a handover. Only the intended recipient may. */
    async accept(caller: Requester, token: string): Promise<IAssetWithAssignee> {
      const handover = await loadHandoverByToken(token);
      return consumeHandoverAsRecipient(caller, handover);
    },

    /** User: accept a pending handover by id (no magic-link token required). */
    async acceptById(caller: Requester, handoverId: string): Promise<IAssetWithAssignee> {
      const handover = await loadOpenHandoverForRecipient(handoverId, caller.id);
      return consumeHandoverAsRecipient(caller, handover);
    },
  };
}

export type HandoverDomain = ReturnType<typeof handoverDomainFactory>;

export default handoverDomainFactory;
