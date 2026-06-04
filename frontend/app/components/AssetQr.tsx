import { useMemo } from 'react';
import { useObjectUrl } from '~/hooks/useObjectUrl';

interface AssetQrProps {
  assetId: string;
  name: string;
  size?: number;
  className?: string;
}

export function AssetQr({ assetId, name, size = 160, className = '' }: AssetQrProps) {
  const path = useMemo(
    () => (assetId ? `/api/p/assets/${assetId}/qr` : null),
    [assetId],
  );
  const src = useObjectUrl(path);

  const dimension = { width: size, height: size };

  if (!src) {
    return (
      <span
        className={`inline-block rounded-md bg-muted/20 animate-pulse shrink-0 ${className}`}
        style={dimension}
        aria-label={name}
      />
    );
  }

  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className={`rounded-md shrink-0 bg-white ${className}`}
      style={dimension}
    />
  );
}
