import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AssetQr } from '~/components/AssetQr';
import { QrIconButton } from '~/components/TableActionButtons';

interface AssetQrHoverPreviewProps {
  assetId: string;
  name: string;
  title: string;
  previewSize?: number;
}

export function AssetQrHoverPreview({
  assetId,
  name,
  title,
  previewSize = 280,
}: AssetQrHoverPreviewProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
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

  return (
    <>
      <QrIconButton
        buttonRef={anchorRef}
        title={title}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => {
          updatePosition();
          setVisible(true);
        }}
        onMouseLeave={() => setVisible(false)}
      />
      {visible &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed z-50 pointer-events-none rounded-lg shadow-lg border border-border bg-surface p-2"
            style={{ top: position.top, left: position.left }}
            role="presentation"
          >
            <AssetQr
              assetId={assetId}
              name={name}
              size={previewSize}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
