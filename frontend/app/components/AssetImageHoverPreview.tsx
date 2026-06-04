import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AssetImage } from '~/components/AssetImage';

interface AssetImageHoverPreviewProps {
  assetId: string;
  name: string;
  hasImage?: boolean | string | null;
  version?: number;
  size?: number;
  previewSize?: number;
}

export function AssetImageHoverPreview({
  assetId,
  name,
  hasImage,
  version = 0,
  size = 40,
  previewSize = 280,
}: AssetImageHoverPreviewProps) {
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

  const show = hasImage && visible;

  return (
    <>
      <span
        ref={anchorRef}
        className="inline-flex"
        onMouseEnter={() => {
          if (hasImage) {
            updatePosition();
            setVisible(true);
          }
        }}
        onMouseLeave={() => setVisible(false)}
        onClick={(e) => e.stopPropagation()}
      >
        <AssetImage
          assetId={assetId}
          name={name}
          hasImage={hasImage}
          size={size}
          version={version}
        />
      </span>
      {show &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed z-50 pointer-events-none rounded-lg shadow-lg border border-border bg-surface p-1"
            style={{ top: position.top, left: position.left }}
            role="presentation"
          >
            <AssetImage
              assetId={assetId}
              name={name}
              hasImage={hasImage}
              size={previewSize}
              version={version}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
