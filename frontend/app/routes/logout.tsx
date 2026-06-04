import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { usePageTitle } from '~/hooks/usePageTitle';
import { useAuth } from '~/providers/AuthProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import { pageMeta } from '~/utils/pageTitle';

export const meta = pageMeta('common.loggingOut');

export default function Logout() {
  usePageTitle('common.loggingOut');
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    void logout().then(() => navigate('/login', { replace: true }));
  }, [logout, navigate]);

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-57px)] p-6">
      <p>{t('common.loggingOut')}</p>
    </div>
  );
}
