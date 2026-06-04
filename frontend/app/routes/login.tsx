import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Button } from '~/components/Button';
import { FormInput } from '~/components/FormInput';
import { PublicAuthCard } from '~/components/public-landing/PublicAuthCard';
import { PublicFormFooter } from '~/components/public-landing/PublicFormFooter';
import { PublicPageLayout } from '~/components/public-landing/PublicPageLayout';
import { useAuth } from '~/providers/AuthProvider';
import { useError } from '~/providers/ErrorProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import { usePublicConfig } from '~/providers/PublicConfigProvider';
import { useSession } from '~/providers/SessionProvider';
import type { ApiResponse } from '~/types';
import { pathAfterLogin } from '~/utils/authRedirect';
import { usePageTitle } from '~/hooks/usePageTitle';
import { pageMeta } from '~/utils/pageTitle';

export const meta = pageMeta('login.title');

const primaryButtonClass = 'w-full shadow-[0_8px_24px_rgb(16_148_97/0.3)]';

export default function Login() {
  usePageTitle('login.title');
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, login } = useAuth();
  const { user, userLoading, setUser } = useSession();
  const { addToast } = useError();
  const { t } = useLanguage();
  const { signupEnabled, loadPublicConfig } = usePublicConfig();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fromPathname = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;

  useEffect(() => {
    loadPublicConfig();
  }, [loadPublicConfig]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !userLoading && user) {
      void navigate(pathAfterLogin(fromPathname, user.roleName), { replace: true });
    }
  }, [isLoading, isAuthenticated, userLoading, user, fromPathname, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = await login(email, password);
      setUser(user);
      void navigate(pathAfterLogin(fromPathname, user.roleName));
    } catch (err) {
      const error = err as ApiResponse;
      addToast({
        type: 'error',
        title: t('common.error'),
        message: error.message || t('common.error'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return null;

  return (
    <PublicPageLayout>
      <PublicAuthCard title={t('login.title')}>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <FormInput
            label={t('login.email')}
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <FormInput
            label={t('login.password')}
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder={t('register.passwordRequirements')}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={submitting}
            className={primaryButtonClass}
          >
            {submitting ? t('common.loading') : t('login.submit')}
          </Button>
        </form>
        <PublicFormFooter>
          <p>
            <Link to="/forgot-password">{t('login.forgotPassword')}</Link>
          </p>
          {signupEnabled && (
            <p>
              {t('login.noAccount')} <Link to="/register">{t('login.register')}</Link>
            </p>
          )}
        </PublicFormFooter>
      </PublicAuthCard>
    </PublicPageLayout>
  );
}
