import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import type { PublicConfigData } from '~/types';
import { api } from '~/utils/api';

interface PublicConfigContextValue {
  signupEnabled: boolean;
  isLoading: boolean;
  loadPublicConfig: () => void;
}

const PublicConfigContext = createContext<PublicConfigContextValue | null>(null);

export function PublicConfigProvider({ children }: { children: ReactNode }) {
  const [signupEnabled, setSignupEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const loadStarted = useRef(false);

  const loadPublicConfig = useCallback(() => {
    if (loadStarted.current) return;
    loadStarted.current = true;
    setIsLoading(true);

    void (async () => {
      try {
        const res = await api.get<PublicConfigData>('/api/session/public-config');
        setSignupEnabled(res.data?.signupEnabled ?? true);
      } catch {
        setSignupEnabled(true);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  return (
    <PublicConfigContext.Provider value={{ signupEnabled, isLoading, loadPublicConfig }}>
      {children}
    </PublicConfigContext.Provider>
  );
}

export function usePublicConfig(): PublicConfigContextValue {
  const ctx = useContext(PublicConfigContext);
  if (!ctx) throw new Error('usePublicConfig must be used within PublicConfigProvider');
  return ctx;
}
