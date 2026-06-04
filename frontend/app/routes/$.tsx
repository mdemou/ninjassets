import { Link } from 'react-router';
import { Button } from '~/components/Button';
import { PublicAuthCard } from '~/components/public-landing/PublicAuthCard';
import { PublicPageLayout } from '~/components/public-landing/PublicPageLayout';
import { usePageTitle } from '~/hooks/usePageTitle';
import { useAuth } from '~/providers/AuthProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import { pageMeta } from '~/utils/pageTitle';

export const meta = pageMeta('notFound.title');

export default function NotFound() {
  usePageTitle('notFound.title');
  const { t } = useLanguage();
  const { isAuthenticated, isLoading } = useAuth();

  if (!isLoading && !isAuthenticated) {
    return (
      <PublicPageLayout>
        <PublicAuthCard>
          <p className="text-center text-6xl font-bold tracking-tight text-primary/20">404</p>
          <h1 className="mt-2 text-center text-2xl font-bold tracking-tight">{t('notFound.title')}</h1>
          <p className="mt-3 text-center text-muted">{t('notFound.message')}</p>
          <Link
            to="/"
            className="mt-8 block no-underline hover:no-underline"
          >
            <Button
              variant="primary"
              className="w-full shadow-[0_8px_24px_rgb(16_148_97/0.3)]"
            >
              {t('notFound.goHome')}
            </Button>
          </Link>
        </PublicAuthCard>
      </PublicPageLayout>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="text-center">
        <p className="text-6xl font-bold tracking-tight text-primary/20">404</p>
        <h1 className="mt-2 text-3xl font-semibold">{t('notFound.title')}</h1>
        <p className="mt-3 text-muted">{t('notFound.message')}</p>
        <Link
          to={isAuthenticated ? '/dashboard' : '/'}
          className="mt-8 inline-block no-underline hover:no-underline"
        >
          <Button variant="primary">{t('notFound.goHome')}</Button>
        </Link>
      </div>
    </div>
  );
}
