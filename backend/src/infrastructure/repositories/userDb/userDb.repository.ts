import { IUser, IUserRole, IUserStatus, IUserWithRole, USER_ROLE_IDS } from '@domain/_interfaces/users.interface';
import { UserRepository } from '@domain/_repositories/user.repository';
import config from '@config/config';
import Boom from '@hapi/boom';
import { Knex } from 'knex';
import logger from '@services/logger.service';
import sqlService from '@services/sql.service';
import { adaptUser, adaptUserWithRole } from './userDb.adapter';
import userDbErrors from './userDb.errors';
import { IUserDB, IUserWithRoleDB } from './userDb.interface';

const userDbRepository: UserRepository = {
  async hasAnyUser(): Promise<boolean> {
    try {
      const result = await sqlService.myDb('user').count('* as count').first();
      return Number((result as { count: string })?.count ?? 0) > 0;
    } catch (error) {
      logger.error(__filename, 'hasAnyUser', 'error', error);
      throw Boom.badImplementation(userDbErrors.internalError.message, {
        code: userDbErrors.internalError.code,
      });
    }
  },

  async findByEmail(email: string): Promise<IUserWithRole | null> {
    try {
      const row: IUserWithRoleDB | undefined = await sqlService
        .myDb('user')
        .select(
          'user.id',
          'user.date_created',
          'user.email',
          'user.display_name',
          'user.hashed',
          'user.salt',
          'user.role_id as role_id',
          'user.status',
          'user.avatar_filename',
          'role.name as role_name',
        )
        .join('role', 'user.role_id', 'role.id')
        .where('user.email', email)
        .first();

      return row ? adaptUserWithRole(row) : null;
    } catch (error) {
      logger.error(__filename, 'findByEmail', 'error', error);
      throw Boom.badImplementation(userDbErrors.internalError.message, {
        code: userDbErrors.internalError.code,
      });
    }
  },

  async findById(id: string): Promise<IUserWithRole | null> {
    try {
      const row: IUserWithRoleDB | undefined = await sqlService
        .myDb('user')
        .select(
          'user.id',
          'user.date_created',
          'user.email',
          'user.display_name',
          'user.hashed',
          'user.salt',
          'user.role_id as role_id',
          'user.status',
          'user.avatar_filename',
          'role.name as role_name',
        )
        .join('role', 'user.role_id', 'role.id')
        .where('user.id', id)
        .first();

      return row ? adaptUserWithRole(row) : null;
    } catch (error) {
      logger.error(__filename, 'findById', 'error', error);
      throw Boom.badImplementation(userDbErrors.internalError.message, {
        code: userDbErrors.internalError.code,
      });
    }
  },

  async findAll(): Promise<IUserWithRole[]> {
    try {
      const rows: IUserWithRoleDB[] = await sqlService
        .myDb('user')
        .select(
          'user.id',
          'user.date_created',
          'user.email',
          'user.display_name',
          'user.hashed',
          'user.salt',
          'user.role_id as role_id',
          'user.status',
          'user.avatar_filename',
          'role.name as role_name',
        )
        .join('role', 'user.role_id', 'role.id')
        .orderBy('user.date_created', 'desc');
      return rows.map((row) => adaptUserWithRole(row));
    } catch (error) {
      logger.error(__filename, 'findAll', 'error', error);
      throw Boom.badImplementation(userDbErrors.internalError.message, {
        code: userDbErrors.internalError.code,
      });
    }
  },

  async searchAndCount({
    search,
    page,
  }: {
    search?: string;
    page?: number;
  }): Promise<{ users: IUserWithRole[]; total: number }> {
    try {
      const applyFilters = (qb: Knex.QueryBuilder): Knex.QueryBuilder => {
        qb.join('role', 'user.role_id', 'role.id');
        if (search) {
          const like = `%${search}%`;
          qb.where((b) => {
            b.whereILike('user.email', like)
              .orWhereILike('user.display_name', like)
              .orWhereILike('role.name', like)
              // status is a Postgres enum — cast to text so ILIKE applies. The ??
              // placeholder quotes the identifier ("user" is a reserved word).
              .orWhereRaw('??::text ILIKE ?', ['user.status', like]);
          });
        }
        return qb;
      };

      const countRow = await applyFilters(sqlService.myDb('user'))
        .countDistinct({ count: 'user.id' })
        .first();
      const total = Number((countRow as { count: string } | undefined)?.count ?? 0);

      const query = applyFilters(sqlService.myDb('user'))
        .select(
          'user.id',
          'user.date_created',
          'user.email',
          'user.display_name',
          'user.hashed',
          'user.salt',
          'user.role_id as role_id',
          'user.status',
          'user.avatar_filename',
          'role.name as role_name',
        )
        .orderBy('user.date_created', 'desc');

      // Paginate only when a page is requested; otherwise return everything
      // (used by dropdowns that need the full list). Page size is server-owned.
      if (page !== undefined) {
        const pageSize = config.pagination.pageSize;
        query.limit(pageSize).offset((page - 1) * pageSize);
      }

      const rows: IUserWithRoleDB[] = await query;
      return { users: rows.map((row) => adaptUserWithRole(row)), total };
    } catch (error) {
      logger.error(__filename, 'searchAndCount', 'error', error);
      throw Boom.badImplementation(userDbErrors.internalError.message, {
        code: userDbErrors.internalError.code,
      });
    }
  },

  async createUser(data): Promise<IUser> {
    try {
      const [row]: IUserDB[] = await sqlService
        .myDb('user')
        .insert({
          email: data.email,
          display_name: data.displayName,
          hashed: data.hashed,
          salt: data.salt,
          role_id: data.roleId,
          status: data.status,
        })
        .returning('*');

      if (!row) {
        throw Boom.badImplementation(userDbErrors.internalError.message, {
          code: userDbErrors.internalError.code,
        });
      }

      return adaptUser(row);
    } catch (error) {
      logger.error(__filename, 'createUser', 'error', error);
      throw Boom.badImplementation(userDbErrors.internalError.message, {
        code: userDbErrors.internalError.code,
      });
    }
  },

  async updatePassword(id: string, hashed: string, salt: string): Promise<void> {
    try {
      await sqlService.myDb('user').where({ id }).update({ hashed, salt });
    } catch (error) {
      logger.error(__filename, 'updatePassword', 'error', error);
      throw Boom.badImplementation(userDbErrors.internalError.message, {
        code: userDbErrors.internalError.code,
      });
    }
  },

  async updateProfile(id: string, data: { displayName?: string }): Promise<void> {
    try {
      const updateData: Record<string, string> = {};
      if (data.displayName !== undefined) updateData.display_name = data.displayName;

      if (Object.keys(updateData).length === 0) {
        return;
      }

      await sqlService.myDb('user').where({ id }).update(updateData);
    } catch (error) {
      logger.error(__filename, 'updateProfile', 'error', error);
      throw Boom.badImplementation(userDbErrors.internalError.message, {
        code: userDbErrors.internalError.code,
      });
    }
  },

  async updateUser(
    id: string,
    data: { email?: string; displayName?: string; roleName?: IUserRole; status?: string },
  ): Promise<void> {
    try {
      const updateData: Record<string, string | number> = {};
      if (data.email !== undefined) updateData.email = data.email;
      if (data.displayName !== undefined) updateData.display_name = data.displayName;
      if (data.roleName !== undefined) {
        const roleId = USER_ROLE_IDS[data.roleName];
        if (roleId !== undefined) updateData.role_id = roleId;
      }
      if (data.status !== undefined) updateData.status = data.status;

      if (Object.keys(updateData).length > 0) {
        await sqlService.myDb('user').where({ id }).update(updateData);
      }
    } catch (error) {
      logger.error(__filename, 'updateUser', 'error', error);
      throw Boom.badImplementation(userDbErrors.internalError.message, {
        code: userDbErrors.internalError.code,
      });
    }
  },

  async updateAvatar(id: string, avatarFilename: string | null): Promise<void> {
    try {
      await sqlService.myDb('user').where({ id }).update({ avatar_filename: avatarFilename });
    } catch (error) {
      logger.error(__filename, 'updateAvatar', 'error', error);
      throw Boom.badImplementation(userDbErrors.internalError.message, {
        code: userDbErrors.internalError.code,
      });
    }
  },

  async activateUser(id: string): Promise<void> {
    try {
      await sqlService.myDb('user').where({ id }).update({ status: IUserStatus.ACTIVE });
    } catch (error) {
      logger.error(__filename, 'activateUser', 'error', error);
      throw Boom.badImplementation(userDbErrors.internalError.message, {
        code: userDbErrors.internalError.code,
      });
    }
  },

  async deactivateUser(id: string): Promise<void> {
    try {
      await sqlService.myDb('user').where({ id }).update({ status: IUserStatus.INACTIVE });
    } catch (error) {
      logger.error(__filename, 'deactivateUser', 'error', error);
      throw Boom.badImplementation(userDbErrors.internalError.message, {
        code: userDbErrors.internalError.code,
      });
    }
  },

  async deleteUser(id: string): Promise<void> {
    try {
      await sqlService.myDb('user').where({ id }).del();
    } catch (error) {
      logger.error(__filename, 'deleteUser', 'error', error);
      throw Boom.badImplementation(userDbErrors.internalError.message, {
        code: userDbErrors.internalError.code,
      });
    }
  },
};

export default userDbRepository;
