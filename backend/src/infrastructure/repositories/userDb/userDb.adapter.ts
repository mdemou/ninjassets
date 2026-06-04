import { IUser, IUserStatus, IUserWithRole } from '@domain/_interfaces/users.interface';
import { IUserDB, IUserWithRoleDB } from './userDb.interface';

export function adaptUser(row: IUserDB): IUser {
  return {
    id: row.id,
    dateCreated: row.date_created,
    email: row.email,
    displayName: row.display_name,
    hashed: row.hashed,
    salt: row.salt,
    roleId: row.role_id,
    status: row.status as IUserStatus,
    avatarFilename: row.avatar_filename ?? null,
  };
}

export function adaptUserWithRole(row: IUserWithRoleDB): IUserWithRole {
  return {
    id: row.id,
    dateCreated: row.date_created,
    email: row.email,
    displayName: row.display_name,
    hashed: row.hashed,
    salt: row.salt,
    roleId: row.role_id,
    status: row.status as IUserStatus,
    avatarFilename: row.avatar_filename ?? null,
    roleName: row.role_name,
  };
}
