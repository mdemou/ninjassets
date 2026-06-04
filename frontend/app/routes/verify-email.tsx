import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PublicAlert } from '~/components/public-landing/PublicAlert';
import { PublicAuthCard } from '~/components/public-landing/PublicAuthCard';
import { PublicFormFooter } from '~/components/public-landing/PublicFormFooter';
import { PublicPageLayout } from '~/components/public-landing/PublicPageLayout';
import { useLanguage } from '~/providers/LanguageProvider';
import type { ApiResponse } from '~/types';
import { api } from '~/utils/api';
import { usePageTitle } from '~/hooks/usePageTitle';
import { pageMeta } from '~/utils/pageTitle';

export const meta = pageMeta('verifyEmail.title');

export default function VerifyEmail() {
  usePageTitle('verifyEmail.title');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { t } = useLanguage();

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>(token ? 'verifying' : 'error');
  const [errorMessage, setErrorMessage] = useState('');
  const verifyRequest = useRef<{ token: string; promise: Promise<void> } | null>(null);

  useEffect(() => {
    if (!token) return;

    const verifiedKey = `verify-email:${token}`;
    if (sessionStorage.getItem(verifiedKey) === '1') {
      setStatus('success');
      return;
    }

    if (!verifyRequest.current || verifyRequest.current.token !== token) {
      verifyRequest.current = {
        token,
        promise: api.post('/api/session/verify-email', { token }).then(() => {
          sessionStorage.setItem(verifiedKey, '1');
        }),
      };
    }

    let cancelled = false;
    verifyRequest.current.promise
      .then(() => {
        if (!cancelled) setStatus('success');
      })
      .catch((err: ApiResponse) => {
        if (!cancelled) {
          setStatus('error');
          setErrorMessage(err.message || t('common.error'));
        }
      });

    return () => {
      cancelled = true;
    };
    // Intentionally omit `t`: including it re-runs verification and can consume the one-time token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <PublicPageLayout>
      <PublicAuthCard title={t('verifyEmail.title')}>
        {status === 'verifying' && (
          <p className="text-center text-muted animate-pulse">{t('verifyEmail.verifying')}</p>
        )}
        {status === 'success' && (
          <>
            <PublicAlert variant="success">
              <p>{t('verifyEmail.success')}</p>
            </PublicAlert>
            <PublicFormFooter>
              <Link to="/login">{t('verifyEmail.login')}</Link>
            </PublicFormFooter>
          </>
        )}
        {status === 'error' && (
          <>
            <PublicAlert variant="error">
              <p>{token ? errorMessage : t('verifyEmail.noToken')}</p>
            </PublicAlert>
            <PublicFormFooter>
              <Link to="/login">{t('verifyEmail.login')}</Link>
            </PublicFormFooter>
          </>
        )}
      </PublicAuthCard>
    </PublicPageLayout>
  );
}
