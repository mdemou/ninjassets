import { UserRepository } from '@domain/_repositories/user.repository';
import Boom from '@hapi/boom';
import { avatarImageStorage, type UploadedImageStorage } from '@services/uploadedImage.service';
import avatarErrors from './avatar.errors';

interface AvatarRepositories {
  userRepository: UserRepository;
}

function avatarDomainFactory(
  repositories: AvatarRepositories,
  service: UploadedImageStorage = avatarImageStorage,
) {
  const { userRepository } = repositories;

  async function requireUser(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw Boom.notFound(avatarErrors.userNotFound.message, { code: avatarErrors.userNotFound.code });
    }
    return user;
  }

  return {
    /** Replace a user's avatar with a freshly processed upload. Old file is removed. */
    async setAvatar(userId: string, buffer: Buffer): Promise<void> {
      const user = await requireUser(userId);
      const filename = await service.processAndStore(buffer);
      await userRepository.updateAvatar(user.id, filename);
      // Best-effort cleanup of the previous file after the row points at the new one.
      await service.remove(user.avatarFilename);
    },

    /** Remove a user's avatar (DB + file). No-op if they have none. */
    async removeAvatar(userId: string): Promise<void> {
      const user = await requireUser(userId);
      if (!user.avatarFilename) return;
      await userRepository.updateAvatar(user.id, null);
      await service.remove(user.avatarFilename);
    },

    /**
     * Resolve the on-disk path of a user's avatar for serving.
     * Throws 404 when the user (or their avatar file) does not exist.
     */
    async getAvatarPath(userId: string): Promise<string> {
      const user = await requireUser(userId);
      if (!user.avatarFilename || !service.exists(user.avatarFilename)) {
        throw Boom.notFound(avatarErrors.avatarNotFound.message, { code: avatarErrors.avatarNotFound.code });
      }
      return service.resolvePath(user.avatarFilename);
    },
  };
}

export default avatarDomainFactory;
