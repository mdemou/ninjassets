import { useMemo } from 'react';
import { useObjectUrl } from '~/hooks/useObjectUrl';

interface AssetImageProps {
  assetId: string;
  name: string;
  hasImage?: boolean | string | null;
  size?: number;
  version?: number;
  className?: string;
}

function assetImageObjectUrlPath(
  assetId: string,
  hasImage: boolean | string | null | undefined,
  version: number,
): string | null {
  if (!hasImage || !assetId) return null;
  return `/api/p/assets/${assetId}/image?v=${version}`;
}

export function AssetImage({
  assetId,
  name,
  hasImage,
  size = 40,
  version = 0,
  className = '',
}: AssetImageProps) {
  const path = useMemo(() => assetImageObjectUrlPath(assetId, hasImage, version), [assetId, hasImage, version]);
  const src = useObjectUrl(path);

  const dimension = { width: size, height: size };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={`rounded-md object-cover shrink-0 bg-muted/20 ${className}`}
        style={dimension}
      />
    );
  }

  return (
    <span
      aria-label={name}
      className={`inline-flex items-center justify-center rounded-md bg-muted/20 text-muted shrink-0 ${className}`}
      style={dimension}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="opacity-50"
        style={{ width: Math.round(size * 0.5), height: Math.round(size * 0.5) }}
        aria-hidden
      >
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          rx="2"
        />
        <circle
          cx="8.5"
          cy="8.5"
          r="1.5"
        />
        <path d="m21 15-5-5L5 21" />
      </svg>
    </span>
  );
}
