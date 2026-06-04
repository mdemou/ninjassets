import config from '@config/config';
import { ILogin, ILoginResponse, IMeResponse, ISession } from '@domain/_interfaces/session.interface';
import { IUserRole, IUserStatus, IUserWithRole } from '@domain/_interfaces/users.interface';
import Boom from '@hapi/boom';
import type { Request } from '@hapi/hapi';
import captchaService from '@services/captcha.service';
import cryptoService from '@services/crypto.service';
import jwtService from '@services/jwt.service';
import logger from '@services/logger.service';
import eventBus from '@services/events/eventBus';
import sessionErrors from './session.errors';

interface ISessionPorts {
  findByEmail: (email: string) => Promise<IUserWithRole | null>;
  findById: (id: string) => Promise<IUserWithRole | null>;
  insertJWT: (token: string, userId: string, platform: string) => Promise<ISession>;
  removeJWT: (token: string) => Promise<void>;
}

const jwtSecretKeys = {
  admin: config.jwt.admin.secretKey,
  user: config.jwt.user.secretKey,
};

// In-memory account lockout tracking
const lockoutStore = new Map<string, { failures: number; lockedUntil: number }>();

function sessionDomainFactory(ports: ISessionPorts) {
  return {
    async login(payload: ILogin): Promise<ILoginResponse> {
      // Validate captcha
      const isCaptchaValid: boolean = await captchaService.validateCaptcha(payload.captchaToken);
      if (!isCaptchaValid) {
        throw Boom.badRequest(sessionErrors.invalidCaptcha.message, {
          code: sessionErrors.invalidCaptcha.code,
        });
      }

      // Check account lockout
      const lockoutEntry = lockoutStore.get(payload.email);
      if (lockoutEntry && lockoutEntry.lockedUntil > Date.now()) {
        throw Boom.tooManyRequests(sessionErrors.accountLocked.message, {
          code: sessionErrors.accountLocked.code,
        } as any);
      }

      // Find user by email
      const user = await ports.findByEmail(payload.email);
      if (!user) {
        throw Boom.badRequest(sessionErrors.invalidCredentials.message, {
          code: sessionErrors.invalidCredentials.code,
        });
      }

      // Check password
      const isPasswordValid = await cryptoService.compareWithHashedPassword(payload.password, user.hashed);
      if (!isPasswordValid) {
        // Track failed attempt
        const entry = lockoutStore.get(payload.email) || { failures: 0, lockedUntil: 0 };
        entry.failures++;
        if (entry.failures >= config.accountLockout.maxAttempts) {
          entry.lockedUntil = Date.now() + config.accountLockout.durationMs;
          entry.failures = 0;
          eventBus.publish({
            type: 'user.locked',
            occurredAt: new Date().toISOString(),
            actor: null,
            subject: { kind: 'user', id: user.id, name: user.displayName },
            detail: 'Too many failed login attempts',
            link: `${config.frontendUrl}/admin/users/${user.id}`,
          });
        }
        lockoutStore.set(payload.email, entry);

        throw Boom.badRequest(sessionErrors.invalidCredentials.message, {
          code: sessionErrors.invalidCredentials.code,
        });
      }

      // Clear lockout on successful login
      lockoutStore.delete(payload.email);

      // Check user status
      if (user.status === IUserStatus.INACTIVE) {
        throw Boom.forbidden(sessionErrors.forbidden.message, {
          code: sessionErrors.forbidden.code,
        });
      }

      // Determine secret key based on role
      const secretKey = user.roleName === (IUserRole.ADMIN as string) ? jwtSecretKeys.admin : jwtSecretKeys.user;

      // Sign JWT
      const token = jwtService.sign({ id: user.id }, secretKey);

      // Store session
      await ports.insertJWT(token, user.id, payload.platform);

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          roleName: user.roleName,
          avatarFilename: user.avatarFilename,
        },
      };
    },

    async me(userId: string): Promise<IMeResponse> {
      const user: IUserWithRole | null = await ports.findById(userId);
      if (!user) {
        throw Boom.notFound(sessionErrors.userNotFound.message, {
          code: sessionErrors.userNotFound.code,
        } as any);
      }
      return {
        user: {
          id: user.id,
          dateCreated: user.dateCreated,
          email: user.email,
          displayName: user.displayName,
          roleName: user.roleName,
          avatarFilename: user.avatarFilename,
        },
      };
    },

    async logout(request: Request): Promise<void> {
      try {
        const token = (request.headers.authorization as string)?.replace('Bearer ', '');
        if (!token) {
          throw Boom.unauthorized(sessionErrors.unauthorized.message);
        }

        await ports.removeJWT(token);
      } catch (error) {
        logger.error(__filename, 'logout', 'error', error);
        if (Boom.isBoom(error)) throw error;
        throw Boom.badImplementation(sessionErrors.internalError.message, {
          code: sessionErrors.internalError.code,
        });
      }
    },
  };
}

export default sessionDomainFactory;
