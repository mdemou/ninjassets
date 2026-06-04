import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '~/components/Button';
import { FormInput } from '~/components/FormInput';
import { PublicAlert } from '~/components/public-landing/PublicAlert';
import { PublicAuthCard } from '~/components/public-landing/PublicAuthCard';
import { PublicFormFooter } from '~/components/public-landing/PublicFormFooter';
import { PublicPageLayout } from '~/components/public-landing/PublicPageLayout';
import { useAuth } from '~/providers/AuthProvider';
import { useError } from '~/providers/ErrorProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import { usePublicConfig } from '~/providers/PublicConfigProvider';
import type { ApiResponse } from '~/types';
import { api } from '~/utils/api';
import { usePageTitle } from '~/hooks/usePageTitle';
import { pageMeta } from '~/utils/pageTitle';

export const meta = pageMeta('register.title');

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
const primaryButtonClass = 'w-full shadow-[0_8px_24px_rgb(16_148_97/0.3)]';

export default function Register() {
  usePageTitle('register.title');
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const { addToast } = useError();
  const { t } = useLanguage();
  const { signupEnabled, isLoading: configLoading, loadPublicConfig } = usePublicConfig();

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadPublicConfig();
  }, [loadPublicConfig]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      void navigate('/dashboard', { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!configLoading && !signupEnabled) {
      void navigate('/login', { replace: true });
    }
  }, [configLoading, signupEnabled, navigate]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!PASSWORD_REGEX.test(password)) {
      newErrors.password = t('common.passwordInvalid');
    }
    if (password !== passwordConfirmation) {
      newErrors.passwordConfirmation = t('common.passwordMismatch');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await api.post('/api/session/register', {
        email,
        displayName,
        password,
        passwordConfirmation,
        captchaToken: '',
      });
      setSuccess(true);
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

  if (isLoading || configLoading || !signupEnabled) return null;

  return (
    <PublicPageLayout>
      <PublicAuthCard title={t('register.title')}>
        {success ? (
          <PublicAlert variant="success">
            <p>{t('register.success')}</p>
          </PublicAlert>
        ) : (
          <>
            <form onSubmit={(e) => void handleSubmit(e)}>
              <FormInput
                label={t('register.email')}
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <FormInput
                label={t('register.displayName')}
                name="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
              <FormInput
                label={t('register.password')}
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                required
                placeholder={t('register.passwordRequirements')}
              />
              <FormInput
                label={t('register.passwordConfirmation')}
                name="passwordConfirmation"
                type="password"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                error={errors.passwordConfirmation}
                required
              />
              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
                className={primaryButtonClass}
              >
                {submitting ? t('common.loading') : t('register.submit')}
              </Button>
            </form>
            <PublicFormFooter>
              <p>
                {t('register.hasAccount')} <Link to="/login">{t('register.login')}</Link>
              </p>
            </PublicFormFooter>
          </>
        )}
      </PublicAuthCard>
    </PublicPageLayout>
  );
}
