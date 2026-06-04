import { useRef, useState, type ChangeEvent } from 'react';
import { Button } from '~/components/Button';
import type { CatalogImageKind } from '~/components/CatalogImage';
import { useError } from '~/providers/ErrorProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import { api } from '~/utils/api';

const ACCEPTED = ['image/jpeg', 'image/png'];
const MAX_BYTES = 1_048_576;

interface CatalogImageUploaderProps {
  kind: CatalogImageKind;
  entityId: string;
  hasImage?: boolean | string | null;
  onChanged: () => void;
}

export function CatalogImageUploader({ kind, entityId, hasImage, onChanged }: CatalogImageUploaderProps) {
  const { t } = useLanguage();
  const { addToast } = useError();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      addToast({ type: 'error', title: t('common.error'), message: t('assets.imageInvalidType') });
      return;
    }
    if (file.size > MAX_BYTES) {
      addToast({ type: 'error', title: t('common.error'), message: t('assets.imageTooLarge') });
      return;
    }
    setUploading(true);
    try {
      await api.upload(`/api/p/${kind}/${entityId}/image`, file);
      addToast({ type: 'success', title: t('common.success'), message: t('assets.imageUploadSuccess') });
      onChanged();
    } catch (err) {
      addToast({
        type: 'error',
        title: t('common.error'),
        message: (err as Error).message || t('common.error'),
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await api.delete(`/api/p/${kind}/${entityId}/image`);
      addToast({ type: 'success', title: t('common.success'), message: t('assets.imageRemoveSuccess') });
      onChanged();
    } catch (err) {
      addToast({
        type: 'error',
        title: t('common.error'),
        message: (err as Error).message || t('common.error'),
      });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={(e) => void handleFile(e)}
      />
      <Button
        type="button"
        variant="secondary"
        disabled={uploading || removing}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? t('common.loading') : t('assets.imageChange')}
      </Button>
      {hasImage && (
        <Button
          type="button"
          variant="tertiary"
          disabled={uploading || removing}
          onClick={() => void handleRemove()}
        >
          {removing ? t('common.loading') : t('assets.imageRemove')}
        </Button>
      )}
      <p className="text-sm text-muted w-full">{t('assets.imageHint')}</p>
    </div>
  );
}
