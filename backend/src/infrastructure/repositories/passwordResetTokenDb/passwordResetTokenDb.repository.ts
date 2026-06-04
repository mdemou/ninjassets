import {
  IPasswordResetToken,
  PasswordResetTokenRepository,
} from '@domain/_repositories/passwordResetToken.repository';
import Boom from '@hapi/boom';
import logger from '@services/logger.service';
import sqlService from '@services/sql.service';
import passwordResetTokenDbErrors from './passwordResetTokenDb.errors';

interface IPasswordResetTokenRowDB {
  id: string;
  date_created: string;
  token: string;
  fk_user_id: string;
  expires_at: string;
}

const passwordResetTokenDbRepository: PasswordResetTokenRepository = {
  async create(token: string, userId: string, expiresAt: Date): Promise<IPasswordResetToken> {
    try {
      const rows = (await sqlService.myDb('password_reset_token')
        .insert({
          token,
          fk_user_id: userId,
          expires_at: expiresAt,
        })
        .returning('*')) as IPasswordResetTokenRowDB[];

      const row = rows[0];
      if (!row) {
        throw new Error('password_reset_token insert returned no row');
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
      throw Boom.badImplementation(passwordResetTokenDbErrors.internalError.message, {
        code: passwordResetTokenDbErrors.internalError.code,
      });
    }
  },

  async findByToken(token: string): Promise<IPasswordResetToken | null> {
    try {
      const row = (await sqlService.myDb('password_reset_token')
        .where({ token })
        .where('expires_at', '>', new Date())
        .first()) as IPasswordResetTokenRowDB | undefined;

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
      throw Boom.badImplementation(passwordResetTokenDbErrors.internalError.message, {
        code: passwordResetTokenDbErrors.internalError.code,
      });
    }
  },

  async findLatestByUserId(userId: string): Promise<IPasswordResetToken | null> {
    try {
      const row = (await sqlService.myDb('password_reset_token')
        .where({ fk_user_id: userId })
        .where('expires_at', '>', new Date())
        .orderBy('date_created', 'desc')
        .first()) as IPasswordResetTokenRowDB | undefined;

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
      throw Boom.badImplementation(passwordResetTokenDbErrors.internalError.message, {
        code: passwordResetTokenDbErrors.internalError.code,
      });
    }
  },

  async deleteByUserId(userId: string): Promise<void> {
    try {
      await sqlService.myDb('password_reset_token').where({ fk_user_id: userId }).del();
    } catch (error) {
      logger.error(__filename, 'deleteByUserId', 'error', error);
      throw Boom.badImplementation(passwordResetTokenDbErrors.internalError.message, {
        code: passwordResetTokenDbErrors.internalError.code,
      });
    }
  },

  async deleteByToken(token: string): Promise<void> {
    try {
      await sqlService.myDb('password_reset_token').where({ token }).del();
    } catch (error) {
      logger.error(__filename, 'deleteByToken', 'error', error);
      throw Boom.badImplementation(passwordResetTokenDbErrors.internalError.message, {
        code: passwordResetTokenDbErrors.internalError.code,
      });
    }
  },

  async deleteExpired(): Promise<number> {
    try {
      return await sqlService.myDb('password_reset_token')
        .where('expires_at', '<=', new Date())
        .del();
    } catch (error) {
      logger.error(__filename, 'deleteExpired', 'error', error);
      throw Boom.badImplementation(passwordResetTokenDbErrors.internalError.message, {
        code: passwordResetTokenDbErrors.internalError.code,
      });
    }
  },
};

export default passwordResetTokenDbRepository;
