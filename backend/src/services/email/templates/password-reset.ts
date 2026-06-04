import config from '@config/config';
import { renderEmailLayout, renderPlainTextEmail } from './layout';

export function passwordResetEmailHtml(token: string, isReset: boolean = true): string {
  const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;

  if (isReset) {
    return renderEmailLayout({
      preheader: 'Reset your ninjasset password — link expires soon.',
      eyebrow: 'Security',
      headline: 'Reset your password',
      paragraphs: [
        'We received a request to reset the password for your <strong>ninjasset</strong> account.',
        'Choose a new password using the button below. For your security, this link works only once and expires after a short period.',
      ],
      cta: { href: resetUrl, label: 'Choose a new password' },
      fallbackUrl: resetUrl,
      expiryHours: config.tokenExpiry.passwordResetHours,
      footerNote:
        'If you did not request a password reset, ignore this email. Your password will stay the same.',
    });
  }

  return renderEmailLayout({
    preheader: 'Activate your ninjasset account and set your password.',
    eyebrow: 'Welcome',
    headline: 'Activate your account',
    paragraphs: [
      'An administrator created a <strong>ninjasset</strong> account for you. Set your password to sign in and view assets assigned to you.',
      'Use the button below to choose a password and activate your account.',
    ],
    cta: { href: resetUrl, label: 'Activate my account' },
    fallbackUrl: resetUrl,
    expiryHours: config.tokenExpiry.passwordResetHours,
    footerNote:
      'If you were not expecting this invitation, ignore this email or contact your IT administrator.',
  });
}

export function passwordResetEmailText(token: string, isReset: boolean = true): string {
  const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;

  if (isReset) {
    return renderPlainTextEmail({
      headline: 'Reset your password',
      paragraphs: [
        'We received a request to reset your ninjasset password.',
        'Visit the link below to choose a new password (one-time use):',
      ],
      cta: { href: resetUrl, label: 'Choose a new password' },
      expiryHours: config.tokenExpiry.passwordResetHours,
      footerNote: 'If you did not request this, ignore this email. Your password will not change.',
    });
  }

  return renderPlainTextEmail({
    headline: 'Activate your account',
    paragraphs: [
      'An administrator created a ninjasset account for you.',
      'Visit the link below to set your password and activate your account:',
    ],
    cta: { href: resetUrl, label: 'Activate my account' },
    expiryHours: config.tokenExpiry.passwordResetHours,
    footerNote: 'If you were not expecting this, ignore this email or contact IT.',
  });
}
