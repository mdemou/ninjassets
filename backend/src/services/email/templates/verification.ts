import config from '@config/config';
import { renderEmailLayout, renderPlainTextEmail } from './layout';

export function verificationEmailHtml(token: string): string {
  const verifyUrl = `${config.frontendUrl}/verify-email?token=${token}`;

  return renderEmailLayout({
    preheader: 'Verify your email to finish setting up ninjasset.',
    eyebrow: 'Account setup',
    headline: 'Verify your email address',
    paragraphs: [
      'Thanks for joining <strong>ninjasset</strong>. Confirm this address belongs to you before you sign in and start tracking assets.',
      'Click the button below to complete verification. The link is unique to you and works only once.',
    ],
    cta: { href: verifyUrl, label: 'Verify my email' },
    fallbackUrl: verifyUrl,
    expiryHours: config.tokenExpiry.emailVerificationHours,
    footerNote:
      'Didn&apos;t create an account? You can safely ignore this message — no changes will be made.',
  });
}

export function verificationEmailText(token: string): string {
  const verifyUrl = `${config.frontendUrl}/verify-email?token=${token}`;

  return renderPlainTextEmail({
    headline: 'Verify your email address',
    paragraphs: [
      'Thanks for joining ninjasset. Confirm this email address belongs to you before signing in.',
      'Visit the link below to complete verification (one-time use):',
    ],
    cta: { href: verifyUrl, label: 'Verify my email' },
    expiryHours: config.tokenExpiry.emailVerificationHours,
    footerNote: "Didn't create an account? You can safely ignore this message.",
  });
}
