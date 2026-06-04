import {
  IChangePasswordPayload,
  IDeleteAccountPayload,
  IUpdateProfilePayload,
} from '@domain/_interfaces/users.interface';
import { SessionRepository } from '@domain/_repositories/session.repository';
import { UserRepository } from '@domain/_repositories/user.repository';
import Boom from '@hapi/boom';
import cryptoService from '@services/crypto.service';
import userErrors from './users.errors';

interface AccountRepositories {
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
}

function accountDomainFactory(repositories: AccountRepositories) {
  const { userRepository, sessionRepository } = repositories;

  return {
    async changePassword(userId: string, currentToken: string, payload: IChangePasswordPayload): Promise<void> {
      const user = await userRepository.findById(userId);
      if (!user) {
        throw Boom.badRequest(userErrors.userNotFound.message, {
          code: userErrors.userNotFound.code,
        });
      }

      // Verify current password
      const isValid = await cryptoService.compareWithHashedPassword(payload.currentPassword, user.hashed);
      if (!isValid) {
        throw Boom.badRequest(userErrors.invalidPassword.message, {
          code: userErrors.invalidPassword.code,
        });
      }

      // Hash new password
      const { hash, salt } = await cryptoService.hashValue(payload.password);

      // Update password
      await userRepository.updatePassword(user.id, hash, salt);

      // Invalidate all sessions except current
      await sessionRepository.removeAllExceptToken(user.id, currentToken);
    },

    async updateProfile(userId: string, payload: IUpdateProfilePayload): Promise<void> {
      const user = await userRepository.findById(userId);
      if (!user) {
        throw Boom.badRequest(userErrors.userNotFound.message, {
          code: userErrors.userNotFound.code,
        });
      }

      await userRepository.updateProfile(user.id, {
        displayName: payload.displayName,
      });
    },

    async deleteAccount(userId: string, payload: IDeleteAccountPayload): Promise<void> {
      const user = await userRepository.findById(userId);
      if (!user) {
        throw Boom.badRequest(userErrors.userNotFound.message, {
          code: userErrors.userNotFound.code,
        });
      }

      // Verify password
      const isValid = await cryptoService.compareWithHashedPassword(payload.password, user.hashed);
      if (!isValid) {
        throw Boom.badRequest(userErrors.invalidPassword.message, {
          code: userErrors.invalidPassword.code,
        });
      }

      // Remove all sessions
      await sessionRepository.removeAllByUserId(user.id);

      // Deactivate user
      await userRepository.deactivateUser(user.id);
    },
  };
}

export default accountDomainFactory;
