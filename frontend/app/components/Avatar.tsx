import { useMemo } from 'react';
import { useObjectUrl } from '~/hooks/useObjectUrl';

interface AvatarProps {
  userId: string;
  name: string;
  /** When falsy, the initials fallback is shown without hitting the network. */
  hasAvatar?: boolean | string | null;
  /** Rendered diameter in pixels. */
  size?: number;
  /** Bump to force a re-fetch after the avatar changes (cache-bust). */
  version?: number;
  className?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic pleasant background colour derived from the name.
function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

function avatarCacheKey(hasAvatar: boolean | string | null | undefined, version: number): string {
  if (typeof hasAvatar === 'string' && hasAvatar.length > 0) {
    return encodeURIComponent(hasAvatar);
  }
  return `v${version}`;
}

function avatarObjectUrlPath(
  userId: string,
  hasAvatar: boolean | string | null | undefined,
  version: number,
): string | null {
  if (!hasAvatar || !userId) return null;
  const key = avatarCacheKey(hasAvatar, version);
  return `/api/users/${userId}/avatar?k=${key}`;
}

export function Avatar({ userId, name, hasAvatar, size = 40, version = 0, className = '' }: AvatarProps) {
  const path = useMemo(() => avatarObjectUrlPath(userId, hasAvatar, version), [userId, hasAvatar, version]);
  const src = useObjectUrl(path);

  const dimension = { width: size, height: size };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={dimension}
      />
    );
  }

  return (
    <span
      aria-label={name}
      className={`inline-flex items-center justify-center rounded-full text-white font-medium select-none shrink-0 ${className}`}
      style={{ ...dimension, backgroundColor: colorFor(name), fontSize: Math.round(size * 0.4) }}
    >
      {getInitials(name)}
    </span>
  );
}
