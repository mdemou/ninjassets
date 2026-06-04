import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '~/components/Button';
import { FormInput } from '~/components/FormInput';
import { PublicAlert } from '~/components/public-landing/PublicAlert';
import { PublicAuthCard } from '~/components/public-landing/PublicAuthCard';
import { PublicFormFooter } from '~/components/public-landing/PublicFormFooter';
import { PublicPageLayout } from '~/components/public-landing/PublicPageLayout';
import { useError } from '~/providers/ErrorProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import type { ApiResponse } from '~/types';
import { api } from '~/utils/api';
import { usePageTitle } from '~/hooks/usePageTitle';
import { pageMeta } from '~/utils/pageTitle';

export const meta = pageMeta('resetPassword.title');

const primaryButtonClass = 'w-full shadow-[0_8px_24px_rgb(16_148_97/0.3)]';

export default function ResetPassword() {
  usePageTitle('resetPassword.title');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { addToast } = useError();
  const { t } = useLanguage();

  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <PublicPageLayout>
        <PublicAuthCard title={t('resetPassword.title')}>
          <PublicAlert variant="error">
            <p>{t('resetPassword.noToken')}</p>
          </PublicAlert>
          <PublicFormFooter>
            <Link to="/forgot-password">{t('resetPassword.requestNew')}</Link>
          </PublicFormFooter>
        </PublicAuthCard>
      </PublicPageLayout>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== passwordConfirmation) {
      addToast({
        type: 'error',
        title: t('common.error'),
        message: t('common.passwordMismatch'),
      });
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/session/reset-password', {
        token,
        password,
        passwordConfirmation,
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

  return (
    <PublicPageLayout>
      <PublicAuthCard title={t('resetPassword.title')}>
        {success ? (
          <>
            <PublicAlert variant="success">
              <p>{t('resetPassword.success')}</p>
            </PublicAlert>
            <PublicFormFooter>
              <Link to="/login">{t('resetPassword.login')}</Link>
            </PublicFormFooter>
          </>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)}>
            <FormInput
              label={t('resetPassword.password')}
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <FormInput
              label={t('resetPassword.passwordConfirmation')}
              name="passwordConfirmation"
              type="password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              required
            />
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
              className={primaryButtonClass}
            >
              {submitting ? t('common.loading') : t('resetPassword.submit')}
            </Button>
          </form>
        )}
      </PublicAuthCard>
    </PublicPageLayout>
  );
}
