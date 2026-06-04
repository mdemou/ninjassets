import { IUserRole, IUserStatus } from './users.interface';

export interface ICreateUser {
  email: string;
  displayName: string;
  roleName: IUserRole;
}

export interface IUpdateUser {
  email?: string;
  displayName?: string;
  roleName?: IUserRole;
  status?: IUserStatus;
}

export interface IAdminChangePassword {
  password: string;
}
