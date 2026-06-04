import {
  EmailVerificationTokenRepository,
  IEmailVerificationToken,
} from '@domain/_repositories/emailVerificationToken.repository';
import Boom from '@hapi/boom';
import logger from '@services/logger.service';
import sqlService from '@services/sql.service';
import emailVerificationTokenDbErrors from './emailVerificationTokenDb.errors';

interface IEmailVerificationTokenRowDB {
  id: string;
  date_created: string;
  token: string;
  fk_user_id: string;
  expires_at: string;
}

const emailVerificationTokenDbRepository: EmailVerificationTokenRepository = {
  async create(token: string, userId: string, expiresAt: Date): Promise<IEmailVerificationToken> {
    try {
      const rows = (await sqlService.myDb('email_verification_token')
        .insert({
          token,
          fk_user_id: userId,
          expires_at: expiresAt,
        })
        .returning('*')) as IEmailVerificationTokenRowDB[];

      const row = rows[0];
      if (!row) {
        throw new Error('email_verification_token insert returned no row');
      }

      return {
        id: row.id,
        dateCreated: row.date_created,
        token: row.token,
        fkUserId: row.fk_user_id,
        expiresAt: row.expires_at,
      };
    } catch (error) {
      logger.error(__filename, 'create', 'error', error);
      throw Boom.badImplementation(emailVerificationTokenDbErrors.internalError.message, {
        code: emailVerificationTokenDbErrors.internalError.code,
      });
    }
  },

  async findByToken(token: string): Promise<IEmailVerificationToken | null> {
    try {
      const row = (await sqlService.myDb('email_verification_token')
        .where({ token })
        .where('expires_at', '>', new Date())
        .first()) as IEmailVerificationTokenRowDB | undefined;

      if (!row) return null;

      return {
        id: row.id,
        dateCreated: row.date_created,
        token: row.token,
        fkUserId: row.fk_user_id,
        expiresAt: row.expires_at,
      };
    } catch (error) {
      logger.error(__filename, 'findByToken', 'error', error);
      throw Boom.badImplementation(emailVerificationTokenDbErrors.internalError.message, {
        code: emailVerificationTokenDbErrors.internalError.code,
      });
    }
  },

  async findLatestByUserId(userId: string): Promise<IEmailVerificationToken | null> {
    try {
      const row = (await sqlService.myDb('email_verification_token')
        .where({ fk_user_id: userId })
        .where('expires_at', '>', new Date())
        .orderBy('date_created', 'desc')
        .first()) as IEmailVerificationTokenRowDB | undefined;

      if (!row) return null;

      return {
        id: row.id,
        dateCreated: row.date_created,
        token: row.token,
        fkUserId: row.fk_user_id,
        expiresAt: row.expires_at,
      };
    } catch (error) {
      logger.error(__filename, 'findLatestByUserId', 'error', error);
      throw Boom.badImplementation(emailVerificationTokenDbErrors.internalError.message, {
        code: emailVerificationTokenDbErrors.internalError.code,
      });
    }
  },

  async deleteByUserId(userId: string): Promise<void> {
    try {
      await sqlService.myDb('email_verification_token').where({ fk_user_id: userId }).del();
    } catch (error) {
      logger.error(__filename, 'deleteByUserId', 'error', error);
      throw Boom.badImplementation(emailVerificationTokenDbErrors.internalError.message, {
        code: emailVerificationTokenDbErrors.internalError.code,
      });
    }
  },

  async deleteByToken(token: string): Promise<void> {
    try {
      await sqlService.myDb('email_verification_token').where({ token }).del();
    } catch (error) {
      logger.error(__filename, 'deleteByToken', 'error', error);
      throw Boom.badImplementation(emailVerificationTokenDbErrors.internalError.message, {
        code: emailVerificationTokenDbErrors.internalError.code,
      });
    }
  },

  async deleteExpired(): Promise<number> {
    try {
      return await sqlService.myDb('email_verification_token')
        .where('expires_at', '<=', new Date())
        .del();
    } catch (error) {
      logger.error(__filename, 'deleteExpired', 'error', error);
      throw Boom.badImplementation(emailVerificationTokenDbErrors.internalError.message, {
        code: emailVerificationTokenDbErrors.internalError.code,
      });
    }
  },
};

export default emailVerificationTokenDbRepository;
