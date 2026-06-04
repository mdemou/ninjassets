import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { Button } from '~/components/Button';
import { PublicAlert } from '~/components/public-landing/PublicAlert';
import { PublicAuthCard } from '~/components/public-landing/PublicAuthCard';
import { PublicPageLayout } from '~/components/public-landing/PublicPageLayout';
import { useAuth } from '~/providers/AuthProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import { useSession } from '~/providers/SessionProvider';
import { api } from '~/utils/api';
import { usePageTitle } from '~/hooks/usePageTitle';
import { pageMeta } from '~/utils/pageTitle';

export const meta = pageMeta('handover.accept.title');

const TOKEN_STORAGE_KEY = 'handover_pending_token';
const primaryButtonClass = 'w-full shadow-[0_8px_24px_rgb(16_148_97/0.3)]';

function isNotForYouError(err: unknown): boolean {
  return (err as Error & { code?: string }).code === 'HND4030';
}

interface HandoverPreview {
  handoverId: string;
  type: 'CHECK_OUT' | 'CHECK_IN';
  expiresAt: string;
  asset: { id: string; name: string; serialNumber: string };
  targetUser: { id: string; displayName: string | null };
}

function HandoverShell({
  title,
  children,
  size = 'lg',
}: {
  title?: string;
  children: ReactNode;
  size?: 'md' | 'lg';
}) {
  return (
    <PublicPageLayout>
      <PublicAuthCard
        title={title}
        size={size}
      >
        {children}
      </PublicAuthCard>
    </PublicPageLayout>
  );
}

export default function HandoverAccept() {
  usePageTitle('handover.accept.title');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { isAuthenticated, isLoading } = useAuth();
  const { user, userLoading } = useSession();

  const queryToken = searchParams.get('token');
  const [token, setToken] = useState<string | null>(null);
  const [preview, setPreview] = useState<HandoverPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notForYou, setNotForYou] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (queryToken) {
      setToken(queryToken);
      if (typeof window !== 'undefined') sessionStorage.setItem(TOKEN_STORAGE_KEY, queryToken);
      return;
    }
    if (typeof window !== 'undefined') {
      setToken(sessionStorage.getItem(TOKEN_STORAGE_KEY));
    }
  }, [queryToken]);

  useEffect(() => {
    if (isLoading || userLoading) return;
    if (!token) {
      setError(t('handover.accept.invalidLink'));
      setLoading(false);
      return;
    }
    if (!isAuthenticated || !user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setError(null);
    setNotForYou(false);
    setLoading(true);
    void (async () => {
      try {
        const res = await api.get<HandoverPreview>(
          `/api/me/handovers/preview?token=${encodeURIComponent(token)}`,
        );
        if (!cancelled) setPreview(res.data ?? null);
      } catch (err) {
        if (!cancelled) {
          if (isNotForYouError(err)) setNotForYou(true);
          else setError((err as Error).message || t('handover.accept.errorTitle'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, isAuthenticated, user, isLoading, userLoading, t]);

  const goToLogin = () => {
    void navigate('/login', { state: { from: location } });
  };

  const handleConfirm = async () => {
    if (!token) return;
    setConfirming(true);
    setError(null);
    setNotForYou(false);
    try {
      await api.post('/api/me/handovers/accept', { token });
      if (typeof window !== 'undefined') sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      setDone(true);
    } catch (err) {
      if (isNotForYouError(err)) setNotForYou(true);
      else setError((err as Error).message || t('handover.accept.errorTitle'));
    } finally {
      setConfirming(false);
    }
  };

  if (isLoading || userLoading || loading) {
    return (
      <HandoverShell title={t('handover.accept.title')}>
        <p className="text-center text-muted animate-pulse">{t('handover.accept.loading')}</p>
      </HandoverShell>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <HandoverShell title={t('handover.accept.title')}>
        <p className="text-center text-muted">{t('handover.accept.loginRequired')}</p>
        <Button
          variant="primary"
          className={`mt-6 ${primaryButtonClass}`}
          onClick={goToLogin}
        >
          {t('handover.accept.loginButton')}
        </Button>
      </HandoverShell>
    );
  }

  if (done && preview) {
    return (
      <HandoverShell title={t('handover.accept.title')}>
        <PublicAlert variant="success">
          {preview.type === 'CHECK_OUT'
            ? t('handover.accept.successCheckout')
            : t('handover.accept.successCheckin')}
        </PublicAlert>
        <Button
          variant="primary"
          className={`mt-6 ${primaryButtonClass}`}
          onClick={() => void navigate('/assets')}
        >
          {t('handover.accept.goToAssets')}
        </Button>
      </HandoverShell>
    );
  }

  if (notForYou) {
    return (
      <HandoverShell title={t('handover.accept.notForYouTitle')}>
        <p className="text-center text-[0.9375rem] leading-relaxed text-muted">
          {t('handover.accept.notForYouBody')}
        </p>
        <Button
          variant="primary"
          className={`mt-6 ${primaryButtonClass}`}
          onClick={() => void navigate('/assets')}
        >
          {t('handover.accept.goToAssets')}
        </Button>
      </HandoverShell>
    );
  }

  if (error || !preview) {
    return (
      <HandoverShell title={t('handover.accept.errorTitle')}>
        <PublicAlert variant="error">
          <p>{error ?? t('handover.accept.invalidLink')}</p>
        </PublicAlert>
      </HandoverShell>
    );
  }

  return (
    <HandoverShell
      title={
        preview.type === 'CHECK_OUT'
          ? t('handover.accept.checkoutHeading')
          : t('handover.accept.checkinHeading')
      }
    >
      <dl className="divide-y divide-border/70 text-sm">
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-muted">{t('handover.accept.assetLabel')}</dt>
          <dd className="font-medium text-right">{preview.asset.name}</dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-muted">{t('handover.accept.serialLabel')}</dt>
          <dd className="font-medium text-right">{preview.asset.serialNumber}</dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-muted">{t('handover.accept.expiresLabel')}</dt>
          <dd className="font-medium text-right">{new Date(preview.expiresAt).toLocaleString()}</dd>
        </div>
      </dl>
      <Button
        variant="primary"
        className={`mt-6 ${primaryButtonClass}`}
        onClick={() => void handleConfirm()}
        disabled={confirming}
      >
        {confirming
          ? t('handover.accept.confirming')
          : preview.type === 'CHECK_OUT'
            ? t('handover.accept.confirmCheckout')
            : t('handover.accept.confirmCheckin')}
      </Button>
    </HandoverShell>
  );
}
