import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '~/types';
import { api } from '~/utils/api';
import { getStoredAuthToken } from '~/utils/authStorage';
import { useAuth } from './AuthProvider';

interface SessionContextValue {
  user: User | null;
  loading: boolean;
  userLoading: boolean;
  /** Bumped whenever the current user's avatar changes, to bust cached images. */
  avatarVersion: number;
  setUser: (user: User) => void;
  updateProfile: (data: { displayName?: string }) => Promise<void>;
  uploadAvatar: (blob: Blob) => Promise<void>;
  removeAvatar: () => Promise<void>;
  changePassword: (data: { currentPassword: string; password: string; passwordConfirmation: string }) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, logout } = useAuth();
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  // Stay in loading state until /me returns so role guards do not run with user === null.
  const [userLoading, setUserLoading] = useState(() => !!getStoredAuthToken());
  const [avatarVersion, setAvatarVersion] = useState(0);

  const setUser = useCallback((user: User) => {
    setUserState(user);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setUserState(null);
      setUserLoading(false);
      return;
    }
    setUserLoading(true);
    void api
      .get<{ user: User }>('/api/session/me')
      .then((res) => {
        if (res.data?.user) setUserState(res.data.user);
      })
      .catch(() => {
        setUserState(null);
      })
      .finally(() => {
        setUserLoading(false);
      });
  }, [isAuthenticated]);

  const updateProfile = useCallback(async (data: { displayName?: string }) => {
    setLoading(true);
    try {
      await api.patch('/api/user/profile', data);
      setUserState((prev) => (prev ? { ...prev, ...data } : prev));
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadAvatar = useCallback(async (blob: Blob) => {
    await api.upload('/api/user/avatar', blob);
    // The filename changes on every upload; refresh so a future reload also shows it.
    const res = await api.get<{ user: User }>('/api/session/me');
    if (res.data?.user) setUserState(res.data.user);
    setAvatarVersion((v) => v + 1);
  }, []);

  const removeAvatar = useCallback(async () => {
    await api.delete('/api/user/avatar');
    setUserState((prev) => (prev ? { ...prev, avatarFilename: null } : prev));
    setAvatarVersion((v) => v + 1);
  }, []);

  const changePassword = useCallback(
    async (data: { currentPassword: string; password: string; passwordConfirmation: string }) => {
      await api.patch('/api/session/change-password', data);
    },
    [],
  );

  const deleteAccount = useCallback(
    async (password: string) => {
      await api.delete('/api/user/account', { password });
      await logout();
    },
    [logout],
  );

  return (
    <SessionContext.Provider
      value={{
        user,
        loading,
        userLoading,
        avatarVersion,
        setUser,
        updateProfile,
        uploadAvatar,
        removeAvatar,
        changePassword,
        deleteAccount,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
