import config from '@config/config';

/**
 * Brand tokens aligned with frontend/app/global.css (inline styles only).
 * Email clients ignore external CSS.
 */
const COLORS = {
  primary: '#109461',
  primaryDark: '#097347',
  primaryXDark: '#075c39',
  primaryLight: '#12a870',
  primary2xLight: '#d1efe3',
  primaryPale: '#b8e5d1',
  secondary: '#152418',
  secondaryLight: '#1f3829',
  surface: '#eef1ef',
  surfaceAlt: '#f8faf9',
  card: '#ffffff',
  border: '#e2e8e0',
  text: '#152418',
  textMuted: '#64748b',
  textLight: '#94a3b8',
  white: '#ffffff',
  ctaShadow: 'rgba(16, 148, 97, 0.35)',
} as const;

const TAGLINE = 'IT asset management, simplified';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface AssetCardParams {
  assetName: string;
  serialNumber: string;
  label?: string;
}

export interface EmailLayoutParams {
  preheader: string;
  headline: string;
  eyebrow?: string;
  greeting?: string;
  /** Body copy — may include safe HTML (e.g. &lt;strong&gt;); user content must be escaped by caller. */
  paragraphs: string[];
  cta?: { href: string; label: string };
  fallbackUrl?: string;
  expiryHours?: number;
  assetCard?: AssetCardParams;
  footerNote?: string;
}

function logoUrl(): string {
  return `${config.frontendUrl}/ninjasset.png`;
}

function emailHeaderHtml(appName: string): string {
  const logo = escapeHtml(logoUrl());

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">
      <tr>
        <td style="background-color:${COLORS.card};border:1px solid ${COLORS.border};border-bottom:none;border-radius:16px 16px 0 0;padding:28px 32px 24px 32px;text-align:center;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
            <tr>
              <td style="vertical-align:middle;padding-right:10px;">
                <img src="${logo}" width="36" height="36" alt="" style="display:block;border:0;outline:none;text-decoration:none;" />
              </td>
              <td style="vertical-align:middle;text-align:left;">
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;line-height:1.2;color:${COLORS.primaryDark};letter-spacing:-0.02em;">
                  ${appName}
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:10px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COLORS.textMuted};line-height:1.4;">
            ${TAGLINE}
          </p>
        </td>
      </tr>
      <tr>
        <td style="background:linear-gradient(90deg, ${COLORS.primaryDark} 0%, ${COLORS.primary} 50%, ${COLORS.primaryLight} 100%);background-color:${COLORS.primary};height:4px;font-size:0;line-height:0;border-left:1px solid ${COLORS.border};border-right:1px solid ${COLORS.border};">&nbsp;</td>
      </tr>
    </table>
  `;
}

function eyebrowHtml(eyebrow: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px 0;">
      <tr>
        <td style="background-color:${COLORS.primary2xLight};border:1px solid ${COLORS.primaryPale};border-radius:999px;padding:6px 14px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.primaryXDark};line-height:1;">
            ${eyebrow}
          </p>
        </td>
      </tr>
    </table>
  `;
}

function assetCardHtml(card: AssetCardParams): string {
  const name = escapeHtml(card.assetName);
  const serial = escapeHtml(card.serialNumber);
  const label = card.label ? escapeHtml(card.label) : 'Asset details';

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0 4px 0;">
      <tr>
        <td style="background-color:${COLORS.surfaceAlt};border:1px solid ${COLORS.border};border-left:4px solid ${COLORS.primary};border-radius:12px;padding:18px 20px;">
          <p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.primaryDark};">
            ${label}
          </p>
          <p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:${COLORS.text};line-height:1.3;">
            ${name}
          </p>
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${COLORS.textMuted};line-height:1.5;">
            Serial&nbsp;&nbsp;<span style="font-family:Consolas,Monaco,'Courier New',monospace;color:${COLORS.text};font-weight:600;">${serial}</span>
          </p>
        </td>
      </tr>
    </table>
  `;
}

function expiryBadgeHtml(hours: number): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0 0 0;">
      <tr>
        <td style="background-color:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:10px;padding:12px 16px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COLORS.textMuted};line-height:1.55;">
            <strong style="color:${COLORS.text};">Time-sensitive</strong> — this link expires in
            <strong style="color:${COLORS.primaryDark};">${hours} hour${hours === 1 ? '' : 's'}</strong>.
          </p>
        </td>
      </tr>
    </table>
  `;
}

function ctaButtonHtml(href: string, label: string): string {
  const safeLabel = escapeHtml(label);

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0 8px 0;">
      <tr>
        <td align="center">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="17%" strokecolor="${COLORS.primary}" fillcolor="${COLORS.primary}">
            <w:anchorlock/>
            <center style="color:${COLORS.white};font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;">${safeLabel}</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${href}"
             target="_blank"
             style="display:inline-block;background-color:${COLORS.primary};color:${COLORS.white};font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;box-shadow:0 8px 24px ${COLORS.ctaShadow};mso-padding-alt:0;">
            ${safeLabel}
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>
  `;
}

function fallbackLinkHtml(url: string): string {
  const safe = escapeHtml(url);

  return `
    <p style="margin:20px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COLORS.textLight};line-height:1.5;text-align:center;">
      Button not working? Copy and paste this link into your browser:
    </p>
    <p style="margin:8px 0 0 0;font-family:Consolas,Monaco,'Courier New',monospace;font-size:12px;line-height:1.5;word-break:break-all;text-align:center;">
      <a href="${url}" target="_blank" style="color:${COLORS.primaryDark};text-decoration:underline;">${safe}</a>
    </p>
  `;
}

/**
 * Renders a complete HTML email with ninjasset branding (matches public landing / auth UI).
 * Table layout for Outlook, Gmail, and Apple Mail.
 */
export function renderEmailLayout(params: EmailLayoutParams): string {
  const appName = escapeHtml(config.appName);
  const year = new Date().getFullYear();
  const eyebrow = params.eyebrow ? escapeHtml(params.eyebrow) : '';
  const headline = escapeHtml(params.headline);
  const preheader = escapeHtml(params.preheader);

  const greetingBlock = params.greeting
    ? `<p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;color:${COLORS.text};line-height:1.6;">${escapeHtml(params.greeting)}</p>`
    : '';

  const paragraphsBlock = params.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${COLORS.textMuted};line-height:1.65;">${p}</p>`,
    )
    .join('');

  const eyebrowBlock = eyebrow ? eyebrowHtml(eyebrow) : '';
  const assetBlock = params.assetCard ? assetCardHtml(params.assetCard) : '';
  const ctaBlock = params.cta ? ctaButtonHtml(params.cta.href, params.cta.label) : '';
  const fallbackBlock =
    params.fallbackUrl && params.cta
      ? fallbackLinkHtml(params.fallbackUrl)
      : params.fallbackUrl
        ? `
    <p style="margin:24px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${COLORS.textLight};line-height:1.5;">
      Copy and paste this link into your browser:
    </p>
    <p style="margin:8px 0 0 0;font-family:Consolas,Monaco,'Courier New',monospace;font-size:12px;line-height:1.5;word-break:break-all;">
      <a href="${params.fallbackUrl}" target="_blank" style="color:${COLORS.primaryDark};text-decoration:underline;">${escapeHtml(params.fallbackUrl)}</a>
    </p>
  `
        : '';
  const expiryBlock = params.expiryHours !== undefined ? expiryBadgeHtml(params.expiryHours) : '';
  const footerNoteBlock = params.footerNote
    ? `<p style="margin:24px 0 0 0;padding-top:20px;border-top:1px solid ${COLORS.border};font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COLORS.textLight};line-height:1.6;">${params.footerNote}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${headline}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.surface};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;color:${COLORS.surface};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
    ${preheader}
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${COLORS.surface};">
    <tr>
      <td align="center" style="padding:40px 16px;">

        ${emailHeaderHtml(appName)}

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:${COLORS.card};border-left:1px solid ${COLORS.border};border-right:1px solid ${COLORS.border};box-shadow:0 20px 60px -12px rgba(0, 0, 0, 0.08);">
          <tr>
            <td style="padding:32px 32px 28px 32px;">
              ${eyebrowBlock}
              <h1 style="margin:0 0 20px 0;font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:700;color:${COLORS.text};line-height:1.25;letter-spacing:-0.02em;">
                ${headline}
              </h1>
              ${greetingBlock}
              ${paragraphsBlock}
              ${assetBlock}
              ${ctaBlock}
              ${fallbackBlock}
              ${expiryBlock}
              ${footerNoteBlock}
            </td>
          </tr>
        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">
          <tr>
            <td style="background-color:${COLORS.card};border:1px solid ${COLORS.border};border-top:none;border-radius:0 0 16px 16px;padding:20px 32px 28px 32px;text-align:center;">
              <p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COLORS.textLight};line-height:1.5;">
                © ${year} ${appName}. All rights reserved.
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COLORS.textLight};line-height:1.5;">
                <a href="${config.frontendUrl}" target="_blank" style="color:${COLORS.primary};font-weight:600;text-decoration:none;">${escapeHtml(config.frontendUrl)}</a>
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface PlainTextEmailParams {
  headline: string;
  greeting?: string;
  paragraphs: string[];
  cta?: { href: string; label: string };
  expiryHours?: number;
  assetLines?: string[];
  footerNote?: string;
}

/** Structured plain-text fallback for clients that do not render HTML. */
export function renderPlainTextEmail(params: PlainTextEmailParams): string {
  const lines: string[] = [
    config.appName.toUpperCase(),
    TAGLINE,
    '─'.repeat(40),
    '',
    params.headline.toUpperCase(),
    '',
  ];

  if (params.greeting) {
    lines.push(params.greeting, '');
  }

  lines.push(...params.paragraphs, '');

  if (params.assetLines?.length) {
    lines.push('--- Asset ---', ...params.assetLines, '');
  }

  if (params.cta) {
    lines.push(`${params.cta.label}:`, params.cta.href, '');
  }

  if (params.expiryHours !== undefined) {
    const h = params.expiryHours;
    lines.push(`This link expires in ${h} hour${h === 1 ? '' : 's'}.`, '');
  }

  if (params.footerNote) {
    lines.push(params.footerNote, '');
  }

  lines.push('─'.repeat(40), `${config.appName} · ${config.frontendUrl}`);

  return lines.join('\n');
}
