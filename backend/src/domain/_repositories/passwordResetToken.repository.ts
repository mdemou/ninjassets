export interface IPasswordResetToken {
  id: string;
  dateCreated: string;
  token: string;
  fkUserId: string;
  expiresAt: string;
}

export interface PasswordResetTokenRepository {
  create(token: string, userId: string, expiresAt: Date): Promise<IPasswordResetToken>;
  findByToken(token: string): Promise<IPasswordResetToken | null>;
  /** Newest unexpired token for a user — used to render emails from a reference job. */
  findLatestByUserId(userId: string): Promise<IPasswordResetToken | null>;
  deleteByUserId(userId: string): Promise<void>;
  deleteByToken(token: string): Promise<void>;
  deleteExpired(): Promise<number>;
}
