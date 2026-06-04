import { ISession, ISessionWithUser } from '@domain/_interfaces/session.interface';

export interface SessionRepository {
  insertJWT(token: string, userId: string, platform: string): Promise<ISession>;
  removeJWT(token: string): Promise<void>;
  checkJWTSession(token: string): Promise<ISessionWithUser | null>;
  removeAllByUserId(userId: string): Promise<void>;
  removeAllExceptToken(userId: string, currentToken: string): Promise<void>;
}
