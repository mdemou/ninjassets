import config from '@config/config';
import { IForgotPasswordPayload, IResetPasswordPayload } from '@domain/_interfaces/passwordReset.interface';
import { PasswordResetTokenRepository } from '@domain/_repositories/passwordResetToken.repository';
import { SessionRepository } from '@domain/_repositories/session.repository';
import { UserRepository } from '@domain/_repositories/user.repository';
import Boom from '@hapi/boom';
import cryptoService from '@services/crypto.service';
import notificationService from '@services/notifications/notificationService';

import { IUserStatus } from '@domain/_interfaces/users.interface';
import passwordResetErrors from './passwordReset.errors';

interface PasswordResetRepositories {
  userRepository: UserRepository;
  passwordResetTokenRepository: PasswordResetTokenRepository;
  sessionRepository: SessionRepository;
}

function passwordResetDomainFactory(repositories: PasswordResetRepositories) {
  const { userRepository, passwordResetTokenRepository, sessionRepository } = repositories;

  return {
    async forgotPassword(payload: IForgotPasswordPayload): Promise<void> {
      // Always return generic success — don't leak whether email exists
      const user = await userRepository.findByEmail(payload.email);
      if (!user || user.status !== IUserStatus.ACTIVE) {
        return;
      }

      // Delete existing reset tokens for this user
      await passwordResetTokenRepository.deleteByUserId(user.id);

      // Generate reset token
      const token = cryptoService.generateToken();
      const expiresAt = new Date(Date.now() + config.tokenExpiry.passwordResetHours * 60 * 60 * 1000);

      await passwordResetTokenRepository.create(token, user.id, expiresAt);

      // Reset email delivered via the notification queue (reference-based; the
      // consumer re-fetches the token by userId, so it never enters Redis).
      await notificationService.email('email.password_reset', { userId: user.id });
    },

    async resetPassword(payload: IResetPasswordPayload): Promise<void> {
      const tokenRecord = await passwordResetTokenRepository.findByToken(payload.token);
      if (!tokenRecord) {
        throw Boom.badRequest(passwordResetErrors.invalidToken.message, {
          code: passwordResetErrors.invalidToken.code,
        });
      }

      const user = await userRepository.findById(tokenRecord.fkUserId);
      if (!user) {
        throw Boom.badRequest(passwordResetErrors.userNotFound.message, {
          code: passwordResetErrors.userNotFound.code,
        });
      }

      // Hash new password
      const { hash, salt } = await cryptoService.hashValue(payload.password);

      // Update password
      await userRepository.updatePassword(user.id, hash, salt);

      // Activate user if they were inactive (e.g. admin-created account awaiting activation)
      if (user.status === IUserStatus.INACTIVE) {
        await userRepository.activateUser(user.id);
      }

      // Delete all reset tokens for this user
      await passwordResetTokenRepository.deleteByUserId(user.id);

      // Invalidate all existing sessions
      await sessionRepository.removeAllByUserId(user.id);
    },
  };
}

export default passwordResetDomainFactory;
