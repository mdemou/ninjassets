import { IEmailOptions } from '@services/email/email.interface';
import { NotificationType } from '@services/notifications/notificationCatalog';
import emailVerificationTokenDbRepository from '@infrastructure/repositories/emailVerificationTokenDb/emailVerificationTokenDb.repository';
import passwordResetTokenDbRepository from '@infrastructure/repositories/passwordResetTokenDb/passwordResetTokenDb.repository';
import userDbRepository from '@infrastructure/repositories/userDb/userDb.repository';
import { verificationEmailHtml, verificationEmailText } from '@services/email/templates/verification';
import { passwordResetEmailHtml, passwordResetEmailText } from '@services/email/templates/password-reset';
import {
  assetUnassignedEmailHtml,
  assetUnassignedEmailText,
} from '@services/email/templates/asset-unassigned';

/**
 * Reference-based renderers (SPEC-WEBHOOK-001 §7): each takes the identifiers
 * carried in the job and re-fetches everything (incl. raw tokens) from the DB,
 * so secrets never travel through Redis. Returning `null` is a terminal,
 * non-error outcome (user/token gone) — the consumer acks and skips.
 *
 * The `Record<NotificationType, ...>` makes this exhaustive: a new catalog type
 * won't compile until a resolver is added here.
 */
type Resolver = (refs: Record<string, unknown>) => Promise<IEmailOptions | null>;

const resolvers: Record<NotificationType, Resolver> = {
  'email.verification': async (refs) => {
    const userId = refs.userId as string;
    const token = await emailVerificationTokenDbRepository.findLatestByUserId(userId);
    if (!token) return null;
    const user = await userDbRepository.findById(userId);
    if (!user) return null;
    return {
      to: user.email,
      subject: 'Verify your email address',
      html: verificationEmailHtml(token.token),
      text: verificationEmailText(token.token),
    };
  },

  'email.account_activation': async (refs) => {
    const userId = refs.userId as string;
    const token = await passwordResetTokenDbRepository.findLatestByUserId(userId);
    if (!token) return null;
    const user = await userDbRepository.findById(userId);
    if (!user) return null;
    return {
      to: user.email,
      subject: 'Activate your account',
      html: passwordResetEmailHtml(token.token, false),
      text: passwordResetEmailText(token.token, false),
    };
  },

  'email.password_reset': async (refs) => {
    const userId = refs.userId as string;
    const token = await passwordResetTokenDbRepository.findLatestByUserId(userId);
    if (!token) return null;
    const user = await userDbRepository.findById(userId);
    if (!user) return null;
    return {
      to: user.email,
      subject: 'Reset your password',
      html: passwordResetEmailHtml(token.token, true),
      text: passwordResetEmailText(token.token, true),
    };
  },

  'email.asset_unassigned': async (refs) => {
    const recipientUserId = refs.recipientUserId as string;
    const assetName = refs.assetName as string;
    const serialNumber = refs.serialNumber as string;
    const user = await userDbRepository.findById(recipientUserId);
    if (!user) return null;
    const params = { recipientName: user.displayName ?? 'there', assetName, serialNumber };
    return {
      to: user.email,
      subject: 'You have been unassigned from an asset',
      html: assetUnassignedEmailHtml(params),
      text: assetUnassignedEmailText(params),
    };
  },
};

/** Render an email notification; returns null when there is nothing to send. */
export function resolveEmail(
  type: NotificationType,
  refs: Record<string, unknown>,
): Promise<IEmailOptions | null> {
  return resolvers[type](refs);
}
