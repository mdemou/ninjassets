import { SessionRepository } from '@domain/_repositories/session.repository';
import type { Request } from '@hapi/hapi';
import logger from '@services/logger.service';

interface UserSessionRepositories {
  sessionRepository: SessionRepository;
}

function userSessionDomainFactory(repositories: UserSessionRepositories) {
  const { sessionRepository } = repositories;

  return {
    async validateJWT(decoded: { id: string }, request: Request) {
      try {
        const authorization = request.headers.authorization;
        const token =
          typeof authorization === 'string' ? authorization.replace('Bearer ', '') : undefined;
        if (!token) {
          return { isValid: false };
        }

        const session = await sessionRepository.checkJWTSession(token);
        if (!session || session.roleName !== 'USER') {
          return { isValid: false };
        }

        return {
          isValid: true,
          credentials: {
            id: session.userId,
            email: session.email,
            role: session.roleName,
          },
        };
      } catch (error) {
        logger.error(__filename, 'validateJWT', 'error', error);
        return { isValid: false };
      }
    },
  };
}

export default userSessionDomainFactory;
