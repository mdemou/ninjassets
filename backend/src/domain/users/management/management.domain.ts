import config from '@config/config';
import { ICreateUser, IUpdateUser } from '@domain/_interfaces/userManagement.interface';
import { IUserStatus, IUserWithRole, USER_ROLE_IDS } from '@domain/_interfaces/users.interface';
import { PasswordResetTokenRepository } from '@domain/_repositories/passwordResetToken.repository';
import { SessionRepository } from '@domain/_repositories/session.repository';
import { UserRepository } from '@domain/_repositories/user.repository';
import Boom from '@hapi/boom';
import cryptoService from '@services/crypto.service';
import eventBus from '@services/events/eventBus';
import notificationService from '@services/notifications/notificationService';
import managementErrors from './management.errors';

interface ManagementRepositories {
  userRepository: UserRepository;
  passwordResetTokenRepository: PasswordResetTokenRepository;
  sessionRepository: SessionRepository;
}

function managementDomainFactory(repositories: ManagementRepositories) {
  const { userRepository, passwordResetTokenRepository, sessionRepository } = repositories;

  return {
    async listUsers(params: { search?: string; page?: number }): Promise<{
      users: Omit<IUserWithRole, 'hashed' | 'salt'>[];
      total: number;
      page: number;
      pageSize: number | null;
    }> {
      // Paginate only when a page is requested; otherwise the full list is returned
      // (e.g. the asset-form assignee dropdown). Page size is server-owned.
      const paginate = params.page !== undefined;
      const page = Math.max(1, params.page ?? 1);
      const { users, total } = await userRepository.searchAndCount({
        search: params.search?.trim() || undefined,
        page: paginate ? page : undefined,
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const safeUsers = users.map(({ hashed, salt, ...safe }) => safe);
      return { users: safeUsers, total, page, pageSize: paginate ? config.pagination.pageSize : null };
    },

    async getUserDetails(id: string): Promise<Omit<IUserWithRole, 'hashed' | 'salt'>> {
      const user = await userRepository.findById(id);
      if (!user) {
        throw Boom.notFound(managementErrors.userNotFound.message, {
          code: managementErrors.userNotFound.code,
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { hashed, salt, ...safe } = user;
      return safe;
    },

    async createUser(payload: ICreateUser): Promise<void> {
      const existingUser = await userRepository.findByEmail(payload.email);
      if (existingUser) {
        throw Boom.conflict(managementErrors.emailAlreadyExists.message, {
          code: managementErrors.emailAlreadyExists.code,
        });
      }

      const roleId = USER_ROLE_IDS[payload.roleName];
      if (roleId === undefined) {
        throw Boom.badRequest(managementErrors.invalidRole.message, {
          code: managementErrors.invalidRole.code,
        });
      }

      const password = cryptoService.generateStrongPassword();
      const { hash, salt } = await cryptoService.hashValue(password);
      const user = await userRepository.createUser({
        email: payload.email,
        displayName: payload.displayName,
        hashed: hash,
        salt,
        roleId,
        status: IUserStatus.INACTIVE,
      });

      const token = cryptoService.generateToken();
      const expiresAt = new Date(Date.now() + config.tokenExpiry.passwordResetHours * 60 * 60 * 1000);
      await passwordResetTokenRepository.create(token, user.id, expiresAt);

      // Activation email delivered via the notification queue (reference-based;
      // the consumer re-fetches the token by userId, so it never enters Redis).
      await notificationService.email('email.account_activation', { userId: user.id });

      eventBus.publish({
        type: 'user.created',
        occurredAt: new Date().toISOString(),
        actor: null,
        subject: { kind: 'user', id: user.id, name: payload.displayName },
        link: `${config.frontendUrl}/admin/users/${user.id}`,
      });
    },

    async updateUser(id: string, payload: IUpdateUser): Promise<void> {
      const user = await userRepository.findById(id);
      if (!user) {
        throw Boom.notFound(managementErrors.userNotFound.message, {
          code: managementErrors.userNotFound.code,
        });
      }

      const updateData: Partial<IUpdateUser> = {};

      if (payload.email !== undefined) {
        if (payload.email !== user.email) {
          const existing = await userRepository.findByEmail(payload.email);
          if (existing) {
            throw Boom.conflict(managementErrors.emailAlreadyExists.message, {
              code: managementErrors.emailAlreadyExists.code,
            });
          }
          updateData.email = payload.email;
        }
      }
      if (payload.displayName !== undefined) updateData.displayName = payload.displayName;
      if (payload.roleName !== undefined) {
        if (USER_ROLE_IDS[payload.roleName] === undefined) {
          throw Boom.badRequest('Invalid role name', {
            code: managementErrors.badRequest('Invalid role name').code,
          });
        }
        updateData.roleName = payload.roleName;
      }
      if (payload.status !== undefined) updateData.status = payload.status;

      if (Object.keys(updateData).length > 0) {
        await userRepository.updateUser(id, updateData);
      }
    },

    async changeUserPassword(id: string, password: string): Promise<void> {
      const user = await userRepository.findById(id);
      if (!user) {
        throw Boom.notFound(managementErrors.userNotFound.message, {
          code: managementErrors.userNotFound.code,
        });
      }

      const { hash, salt } = await cryptoService.hashValue(password);
      await userRepository.updatePassword(id, hash, salt);

      // Invalidate all existing sessions so the user must re-login with the new password.
      await sessionRepository.removeAllByUserId(id);
    },

    async deleteUser(id: string): Promise<void> {
      const user = await userRepository.findById(id);
      if (!user) {
        throw Boom.notFound(managementErrors.userNotFound.message, {
          code: managementErrors.userNotFound.code,
        });
      }
      await userRepository.deleteUser(id);

      eventBus.publish({
        type: 'user.deleted',
        occurredAt: new Date().toISOString(),
        actor: null,
        subject: { kind: 'user', id: user.id, name: user.displayName },
      });
    },
  };
}

export default managementDomainFactory;
