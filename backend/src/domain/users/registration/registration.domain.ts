import config from '@config/config';
import { IRegister, IResendVerification, IVerifyEmail } from '@domain/_interfaces/registration.interface';
import { IUserRole, IUserStatus, USER_ROLE_IDS } from '@domain/_interfaces/users.interface';
import { EmailVerificationTokenRepository } from '@domain/_repositories/emailVerificationToken.repository';
import { UserRepository } from '@domain/_repositories/user.repository';
import Boom from '@hapi/boom';
import captchaService from '@services/captcha.service';
import cryptoService from '@services/crypto.service';
import eventBus from '@services/events/eventBus';
import notificationService from '@services/notifications/notificationService';
import registrationErrors from './registration.errors';

interface RegistrationRepositories {
  userRepository: UserRepository;
  emailVerificationTokenRepository: EmailVerificationTokenRepository;
}

function registrationDomainFactory(repositories: RegistrationRepositories) {
  const { userRepository, emailVerificationTokenRepository } = repositories;

  return {
    async register(payload: IRegister): Promise<void> {
      if (!config.signupEnabled) {
        throw Boom.forbidden(registrationErrors.signupDisabled.message, {
          code: registrationErrors.signupDisabled.code,
        });
      }

      // Validate captcha
      const isCaptchaValid = await captchaService.validateCaptcha(payload.captchaToken);
      if (!isCaptchaValid) {
        throw Boom.badRequest(registrationErrors.invalidCaptcha.message, {
          code: registrationErrors.invalidCaptcha.code,
        });
      }

      // Check if email already exists — always return generic success
      const existingEmail = await userRepository.findByEmail(payload.email);
      if (existingEmail) {
        return;
      }

      // Hash password
      const { hash, salt } = await cryptoService.hashValue(payload.password);

      // Create user with INACTIVE status (pending email verification)
      const user = await userRepository.createUser({
        email: payload.email,
        displayName: payload.displayName,
        hashed: hash,
        salt,
        roleId: USER_ROLE_IDS[IUserRole.USER],
        status: IUserStatus.INACTIVE,
      });

      // Generate verification token
      const token = cryptoService.generateToken();
      const expiresAt = new Date(Date.now() + config.tokenExpiry.emailVerificationHours * 60 * 60 * 1000);

      await emailVerificationTokenRepository.create(token, user.id, expiresAt);

      // Verification email is delivered via the notification queue (reference-based:
      // the consumer re-fetches the token by userId, so it never enters Redis).
      await notificationService.email('email.verification', { userId: user.id });

      eventBus.publish({
        type: 'user.registered',
        occurredAt: new Date().toISOString(),
        actor: { id: user.id, name: payload.displayName },
        subject: { kind: 'user', id: user.id, name: payload.displayName },
        link: `${config.frontendUrl}/admin/users/${user.id}`,
      });
    },

    async verifyEmail(payload: IVerifyEmail): Promise<void> {
      const tokenRecord = await emailVerificationTokenRepository.findByToken(payload.token);
      if (!tokenRecord) {
        throw Boom.badRequest(registrationErrors.invalidToken.message, {
          code: registrationErrors.invalidToken.code,
        });
      }

      const user = await userRepository.findById(tokenRecord.fkUserId);
      if (!user) {
        throw Boom.badRequest(registrationErrors.userNotFound.message, {
          code: registrationErrors.userNotFound.code,
        });
      }

      if (user.status === IUserStatus.ACTIVE) {
        await emailVerificationTokenRepository.deleteByToken(payload.token);
        return;
      }

      // Activate user and clean up tokens
      await userRepository.activateUser(user.id);
      await emailVerificationTokenRepository.deleteByUserId(user.id);
    },

    async resendVerification(payload: IResendVerification): Promise<void> {
      const user = await userRepository.findByEmail(payload.email);
      if (!user || user.status === IUserStatus.ACTIVE) {
        return; // Don't leak info
      }

      // Delete existing tokens for this user
      await emailVerificationTokenRepository.deleteByUserId(user.id);

      // Generate new token
      const token = cryptoService.generateToken();
      const expiresAt = new Date(Date.now() + config.tokenExpiry.emailVerificationHours * 60 * 60 * 1000);

      await emailVerificationTokenRepository.create(token, user.id, expiresAt);

      await notificationService.email('email.verification', { userId: user.id });
    },
  };
}

export default registrationDomainFactory;
