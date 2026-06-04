import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
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

export const meta = pageMeta('forgotPassword.title');

const primaryButtonClass = 'w-full shadow-[0_8px_24px_rgb(16_148_97/0.3)]';

export default function ForgotPassword() {
  usePageTitle('forgotPassword.title');
  const { addToast } = useError();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/api/session/forgot-password', { email });
      setSent(true);
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
      <PublicAuthCard title={t('forgotPassword.title')}>
        {sent ? (
          <PublicAlert variant="info">
            <p>{t('forgotPassword.success')}</p>
          </PublicAlert>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)}>
            <FormInput
              label={t('forgotPassword.email')}
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
              className={primaryButtonClass}
            >
              {submitting ? t('common.loading') : t('forgotPassword.submit')}
            </Button>
          </form>
        )}
        <PublicFormFooter>
          <Link to="/login">{t('forgotPassword.backToLogin')}</Link>
        </PublicFormFooter>
      </PublicAuthCard>
    </PublicPageLayout>
  );
}
