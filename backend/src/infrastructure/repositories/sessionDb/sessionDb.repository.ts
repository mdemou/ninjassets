import { ISession, ISessionWithUser } from '@domain/_interfaces/session.interface';
import { SessionRepository } from '@domain/_repositories/session.repository';
import Boom from '@hapi/boom';
import logger from '@services/logger.service';
import sqlService from '@services/sql.service';
import sessionDbErrors from './sessionDb.errors';

interface ISessionRowDB {
  id: string;
  date_created: string;
  token_val: string;
  status: boolean;
  fk_user_id: string;
  platform: string;
}

interface ISessionWithUserRowDB {
  id: string;
  tokenVal: string;
  userId: string;
  email: string;
  displayName: string;
  roleName: string;
  status: string;
}

const sessionDbRepository: SessionRepository = {
  async insertJWT(token: string, userId: string, platform: string): Promise<ISession> {
    try {
      const rows = (await sqlService.myDb('session')
        .insert({
          token_val: token,
          fk_user_id: userId,
          platform,
        })
        .returning('*')) as ISessionRowDB[];

      const row = rows[0];
      if (!row) {
        throw new Error('session insert returned no row');
      }

      return {
        id: row.id,
        dateCreated: row.date_created,
        tokenVal: row.token_val,
        status: row.status,
        fkUserId: row.fk_user_id,
        platform: row.platform,
      };
    } catch (error) {
      logger.error(__filename, 'insertJWT', 'error', error);
      throw Boom.badImplementation(sessionDbErrors.internalError.message, {
        code: sessionDbErrors.internalError.code,
      });
    }
  },

  async removeJWT(token: string): Promise<void> {
    try {
      await sqlService.myDb('session').where({ token_val: token }).del();
    } catch (error) {
      logger.error(__filename, 'removeJWT', 'error', error);
      throw Boom.badImplementation(sessionDbErrors.internalError.message, {
        code: sessionDbErrors.internalError.code,
      });
    }
  },

  async checkJWTSession(token: string): Promise<ISessionWithUser | null> {
    try {
      const row = (await sqlService.myDb('session')
        .select(
          'session.id',
          'session.token_val as tokenVal',
          'user.id as userId',
          'user.email',
          'user.display_name as displayName',
          'role.name as roleName',
          'user.status',
        )
        .join('user', 'session.fk_user_id', 'user.id')
        .join('role', 'user.role_id', 'role.id')
        .where('session.token_val', token)
        .where('session.status', true)
        .first()) as ISessionWithUserRowDB | undefined;

      if (!row) return null;

      return {
        id: row.id,
        tokenVal: row.tokenVal,
        userId: row.userId,
        email: row.email,
        displayName: row.displayName,
        roleName: row.roleName,
        status: row.status,
      };
    } catch (error) {
      logger.error(__filename, 'checkJWTSession', 'error', error);
      throw Boom.badImplementation(sessionDbErrors.internalError.message, {
        code: sessionDbErrors.internalError.code,
      });
    }
  },

  async removeAllByUserId(userId: string): Promise<void> {
    try {
      await sqlService.myDb('session').where({ fk_user_id: userId }).del();
    } catch (error) {
      logger.error(__filename, 'removeAllByUserId', 'error', error);
      throw Boom.badImplementation(sessionDbErrors.internalError.message, {
        code: sessionDbErrors.internalError.code,
      });
    }
  },

  async removeAllExceptToken(userId: string, currentToken: string): Promise<void> {
    try {
      await sqlService.myDb('session')
        .where({ fk_user_id: userId })
        .whereNot({ token_val: currentToken })
        .del();
    } catch (error) {
      logger.error(__filename, 'removeAllExceptToken', 'error', error);
      throw Boom.badImplementation(sessionDbErrors.internalError.message, {
        code: sessionDbErrors.internalError.code,
      });
    }
  },
};

export default sessionDbRepository;
