import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from '~/components/Avatar';

interface AvatarHoverPreviewProps {
  userId: string;
  name: string;
  hasAvatar?: boolean | string | null;
  version?: number;
  size?: number;
  previewSize?: number;
}

export function AvatarHoverPreview({
  userId,
  name,
  hasAvatar,
  version = 0,
  size = 40,
  previewSize = 280,
}: AvatarHoverPreviewProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 8;
    let left = rect.right + gap;
    let top = rect.top;
    if (left + previewSize > window.innerWidth - gap) {
      left = rect.left - previewSize - gap;
    }
    if (top + previewSize > window.innerHeight - gap) {
      top = window.innerHeight - previewSize - gap;
    }
    if (top < gap) top = gap;
    setPosition({ top, left });
  }, [previewSize]);

  useEffect(() => {
    if (!visible) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [visible, updatePosition]);

  const show = hasAvatar && visible;

  return (
    <>
      <span
        ref={anchorRef}
        className="inline-flex"
        onMouseEnter={() => {
          if (hasAvatar) {
            updatePosition();
            setVisible(true);
          }
        }}
        onMouseLeave={() => setVisible(false)}
        onClick={(e) => e.stopPropagation()}
      >
        <Avatar
          userId={userId}
          name={name}
          hasAvatar={hasAvatar}
          size={size}
          version={version}
        />
      </span>
      {show &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed z-50 pointer-events-none rounded-full shadow-lg border border-border bg-surface p-1"
            style={{ top: position.top, left: position.left }}
            role="presentation"
          >
            <Avatar
              userId={userId}
              name={name}
              hasAvatar={hasAvatar}
              size={previewSize}
              version={version}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
