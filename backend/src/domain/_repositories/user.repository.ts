import { IUpdateUser } from '@domain/_interfaces/userManagement.interface';
import { IUser, IUserWithRole } from '@domain/_interfaces/users.interface';

export interface UserRepository {
  hasAnyUser(): Promise<boolean>;
  findByEmail(email: string): Promise<IUserWithRole | null>;
  findById(id: string): Promise<IUserWithRole | null>;
  findAll(): Promise<IUserWithRole[]>;
  searchAndCount(params: { search?: string; page?: number }): Promise<{
    users: IUserWithRole[];
    total: number;
  }>;
  createUser(data: {
    email: string;
    displayName: string;
    hashed: string;
    salt: string;
    roleId: number;
    status: string;
  }): Promise<IUser>;
  updatePassword(id: string, hashed: string, salt: string): Promise<void>;
  updateProfile(id: string, data: { displayName?: string }): Promise<void>;
  updateAvatar(id: string, avatarFilename: string | null): Promise<void>;
  updateUser(id: string, data: IUpdateUser): Promise<void>;
  activateUser(id: string): Promise<void>;
  deactivateUser(id: string): Promise<void>;
  deleteUser(id: string): Promise<void>;
}
