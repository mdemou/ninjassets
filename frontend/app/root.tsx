import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';
import { Navbar } from '~/components/Navbar';
import { Sidebar } from '~/components/Sidebar';
import { AuthProvider } from '~/providers/AuthProvider';
import { PublicConfigProvider } from '~/providers/PublicConfigProvider';
import { ErrorProvider } from '~/providers/ErrorProvider';
import { LanguageProvider } from '~/providers/LanguageProvider';
import { AppSkeletonTheme } from '~/components/LoadingSkeleton';
import { SessionProvider } from '~/providers/SessionProvider';
import { pageTitleMeta } from '~/utils/pageTitle';
import './global.css';

export function meta() {
  return pageTitleMeta();
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
        <meta
          name="theme-color"
          content="#000000"
        />
        <link
          rel="icon"
          href="/favicon.ico"
          sizes="any"
        />
        <link
          rel="icon"
          href="/favicon-16x16.png"
          type="image/png"
          sizes="16x16"
        />
        <link
          rel="icon"
          href="/favicon-32x32.png"
          type="image/png"
          sizes="32x32"
        />
        <link
          rel="apple-touch-icon"
          href="/apple-touch-icon.png"
          sizes="180x180"
        />
        <link
          rel="manifest"
          href="/site.webmanifest"
        />
        <Meta />
        <Links />
      </head>
      <body className="font-sans h-screen flex flex-col overflow-hidden">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  return (
    <LanguageProvider>
      <AppSkeletonTheme>
        <ErrorProvider>
          <PublicConfigProvider>
            <AuthProvider>
              <SessionProvider>
                <Navbar />
                <div className="flex flex-1 min-h-0">
                  <Sidebar />
                  <main className="flex-1 min-w-0 overflow-auto">
                    <Outlet />
                  </main>
                </div>
              </SessionProvider>
            </AuthProvider>
          </PublicConfigProvider>
        </ErrorProvider>
      </AppSkeletonTheme>
    </LanguageProvider>
  );
}
