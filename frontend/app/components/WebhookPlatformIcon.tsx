import { useObjectUrl } from '~/hooks/useObjectUrl';
import type { WebhookPlatform } from '~/types';

interface WebhookPlatformIconProps {
  platformIconUrl: string;
  platform: WebhookPlatform;
  size?: number;
  className?: string;
}

export function WebhookPlatformIcon({
  platformIconUrl,
  platform,
  size = 24,
  className = '',
}: WebhookPlatformIconProps) {
  const objectUrl = useObjectUrl(platformIconUrl);

  if (!objectUrl) {
    return (
      <span
        className={`inline-block shrink-0 rounded bg-muted/30 ${className}`}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }

  return (
    <img
      src={objectUrl}
      alt={platform}
      width={size}
      height={size}
      className={`shrink-0 rounded object-contain ${className}`}
    />
  );
}
