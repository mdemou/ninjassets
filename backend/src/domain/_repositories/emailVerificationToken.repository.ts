export interface IEmailVerificationToken {
  id: string;
  dateCreated: string;
  token: string;
  fkUserId: string;
  expiresAt: string;
}

export interface EmailVerificationTokenRepository {
  create(token: string, userId: string, expiresAt: Date): Promise<IEmailVerificationToken>;
  findByToken(token: string): Promise<IEmailVerificationToken | null>;
  /** Newest unexpired token for a user — used to render emails from a reference job. */
  findLatestByUserId(userId: string): Promise<IEmailVerificationToken | null>;
  deleteByUserId(userId: string): Promise<void>;
  deleteByToken(token: string): Promise<void>;
  deleteExpired(): Promise<number>;
}
