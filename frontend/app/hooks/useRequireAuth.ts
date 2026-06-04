import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '~/providers/AuthProvider';

/** Redirects unauthenticated visitors to login, preserving the current path for return after sign-in. */
export function useRequireAuth(): { isReady: boolean } {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      void navigate('/login', { replace: true, state: { from: location } });
    }
  }, [isLoading, isAuthenticated, navigate, location]);

  return { isReady: !isLoading && isAuthenticated };
}
