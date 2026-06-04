import { useRef, useState, type ChangeEvent } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { Button } from '~/components/Button';
import { Modal } from '~/components/Modal';
import { useError } from '~/providers/ErrorProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import { getCroppedBlob } from '~/utils/cropImage';

const ACCEPTED = ['image/jpeg', 'image/png'];

interface AvatarUploaderProps {
  onUpload: (blob: Blob) => void | Promise<void>;
  label?: string;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger';
}

export function AvatarUploader({ onUpload, label, variant = 'secondary' }: AvatarUploaderProps) {
  const { t } = useLanguage();
  const { addToast } = useError();
  const inputRef = useRef<HTMLInputElement>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const closeModal = () => {
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file again still fires onChange.
    e.target.value = '';
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      addToast({ type: 'error', title: t('common.error'), message: t('avatar.invalidType') });
      return;
    }
    setImageSrc(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setSaving(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      await onUpload(blob);
      closeModal();
    } catch (err) {
      addToast({
        type: 'error',
        title: t('common.error'),
        message: (err as Error).message || t('common.error'),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={handleFile}
      />
      <Button
        type="button"
        variant={variant}
        onClick={() => inputRef.current?.click()}
      >
        {label ?? t('avatar.change')}
      </Button>

      <Modal
        isOpen={imageSrc !== null}
        onClose={closeModal}
        title={t('avatar.cropTitle')}
        size="lg"
      >
        <div className="relative w-full h-72 bg-black/80 rounded-lg overflow-hidden">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_area, pixels) => setCroppedAreaPixels(pixels)}
            />
          )}
        </div>
        <div className="mt-4">
          <label className="block text-sm text-muted mb-1">{t('avatar.zoom')}</label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button
            variant="tertiary"
            type="button"
            onClick={closeModal}
            disabled={saving}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !croppedAreaPixels}
          >
            {saving ? t('common.loading') : t('avatar.save')}
          </Button>
        </div>
      </Modal>
    </>
  );
}
