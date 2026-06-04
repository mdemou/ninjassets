export interface IUser {
  id: string;
  dateCreated: string;
  email: string;
  displayName: string;
  hashed: string;
  salt: string;
  roleId: number;
  status: IUserStatus;
  avatarFilename: string | null;
}

export interface IUserWithRole extends IUser {
  roleName: string;
}

export enum IUserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum IUserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

/** Maps role names to DB role IDs (from migration seed order) */
export const USER_ROLE_IDS: Record<IUserRole, number> = {
  [IUserRole.ADMIN]: 1,
  [IUserRole.USER]: 2,
};

export interface IChangePasswordPayload {
  currentPassword: string;
  password: string;
  passwordConfirmation: string;
}

export interface IUpdateProfilePayload {
  displayName?: string;
}

export interface IDeleteAccountPayload {
  password: string;
}
