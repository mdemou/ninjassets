import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { Button } from '~/components/Button';
import { Modal } from '~/components/Modal';
import { Panel } from '~/components/Panel';
import { useError } from '~/providers/ErrorProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import type { ApiResponse } from '~/types';
import { api, postForBlob } from '~/utils/api';

type CustodyType = 'CHECK_OUT' | 'CHECK_IN';

interface CustodyDocumentRecord {
  id: string;
  dateCreated: string;
  type: CustodyType;
  handoverId: string | null;
  originalFilename: string;
  documentDate: string | null;
  notes: string | null;
  uploadedByName: string | null;
}

interface CustodyDocumentsPanelProps {
  assetId: string;
  status: string;
  assignedUserId: string | null;
  /** Reload the parent asset + history after a custody-document change. */
  onChanged: () => void;
  /** Omit outer Panel wrapper when nested inside asset detail tabs. */
  embedded?: boolean;
}

export function CustodyDocumentsPanel({
  assetId,
  status,
  assignedUserId,
  onChanged,
  embedded = false,
}: CustodyDocumentsPanelProps) {
  const { t, language } = useLanguage();
  const { addToast } = useError();

  const [documents, setDocuments] = useState<CustodyDocumentRecord[]>([]);
  const [busy, setBusy] = useState(false);

  // Generate dialog state.
  const [genOpen, setGenOpen] = useState(false);
  const [genType, setGenType] = useState<CustodyType>('CHECK_OUT');
  const [genCondition, setGenCondition] = useState('');
  const [genAccessories, setGenAccessories] = useState('');

  // Upload form state.
  const [uploadType, setUploadType] = useState<CustodyType>('CHECK_OUT');
  const [uploadNotes, setUploadNotes] = useState('');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview modal state.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewPath, setPreviewPath] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!assetId) return;
    try {
      const res = await api.get<{ documents: CustodyDocumentRecord[] }>(
        `/api/p/assets/${assetId}/custody-documents`,
      );
      setDocuments(res.data?.documents ?? []);
    } catch {
      // Non-fatal: the section just shows no documents.
    }
  }, [assetId]);

  useEffect(() => {
    void load();
  }, [load]);

  const fail = (err: unknown) =>
    addToast({
      type: 'error',
      title: t('common.error'),
      message: (err as ApiResponse).message || t('common.error'),
    });

  const typeLabel = (type: CustodyType) =>
    type === 'CHECK_OUT' ? t('custodyDocument.typeCheckout') : t('custodyDocument.typeCheckin');

  const openGenerate = (type: CustodyType) => {
    setGenType(type);
    setGenCondition('');
    setGenAccessories('');
    setGenOpen(true);
  };

  const submitGenerate = async () => {
    setBusy(true);
    try {
      const blob = await postForBlob(
        `/api/p/assets/${assetId}/custody-documents/generate?lang=${language}`,
        {
          type: genType,
          condition: genCondition || null,
          accessoriesNote: genAccessories || null,
        },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `custody-${genType === 'CHECK_IN' ? 'return' : 'checkout'}-${assetId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setGenOpen(false);
      addToast({ type: 'success', title: t('custodyDocument.generated'), message: '' });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const submitUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      addToast({ type: 'error', title: t('custodyDocument.noFile'), message: '' });
      return;
    }
    setBusy(true);
    try {
      const params = new URLSearchParams({ type: uploadType, filename: file.name });
      if (uploadNotes) params.set('notes', uploadNotes);
      await api.upload(`/api/p/assets/${assetId}/custody-documents/upload?${params.toString()}`, file);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSelectedFileName(null);
      setUploadNotes('');
      addToast({ type: 'success', title: t('custodyDocument.uploaded'), message: '' });
      await load();
      onChanged();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const onFilePicked = () => {
    setSelectedFileName(fileInputRef.current?.files?.[0]?.name ?? null);
  };

  const onDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !fileInputRef.current) return;
    // Mirror the dropped file into the hidden input so submitUpload reads it uniformly.
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInputRef.current.files = dt.files;
    setSelectedFileName(file.name);
  };

  const openPreview = async (doc: CustodyDocumentRecord) => {
    const path = `/api/p/assets/${assetId}/custody-documents/${doc.id}/file`;
    const url = await api.fetchObjectUrl(path);
    if (!url) {
      addToast({ type: 'error', title: t('custodyDocument.previewUnavailable'), message: '' });
      return;
    }
    setPreviewPath(path);
    setPreviewUrl(url);
  };

  const closePreview = () => {
    if (previewPath) api.releaseObjectUrl(previewPath);
    setPreviewPath(null);
    setPreviewUrl(null);
  };

  const downloadDoc = async (doc: CustodyDocumentRecord) => {
    const path = `/api/p/assets/${assetId}/custody-documents/${doc.id}/file`;
    const url = await api.fetchObjectUrl(path);
    if (!url) {
      fail({ message: t('custodyDocument.previewUnavailable') });
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.originalFilename || 'custody-document.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    api.releaseObjectUrl(path);
  };

  const deleteDoc = async (doc: CustodyDocumentRecord) => {
    if (!window.confirm(t('custodyDocument.confirmDelete'))) return;
    setBusy(true);
    try {
      await api.delete(`/api/p/assets/${assetId}/custody-documents/${doc.id}`);
      addToast({ type: 'success', title: t('custodyDocument.deleted'), message: '' });
      await load();
      onChanged();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const canCheckin = status === 'ASSIGNED' && !!assignedUserId;

  const body = (
      <div className="space-y-4 text-sm">
        {/* Print actions */}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => openGenerate('CHECK_OUT')} disabled={busy}>
            {t('custodyDocument.printCheckout')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => openGenerate('CHECK_IN')}
            disabled={busy || !canCheckin}
          >
            {t('custodyDocument.printCheckin')}
          </Button>
        </div>

        {/* Upload signed receipt */}
        <div className="rounded-lg border border-border p-3 space-y-3">
          <p className="font-medium">{t('custodyDocument.uploadTitle')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="px-3 py-2 border border-border rounded bg-input text-foreground"
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value as CustodyType)}
            >
              <option value="CHECK_OUT">{t('custodyDocument.typeCheckout')}</option>
              <option value="CHECK_IN">{t('custodyDocument.typeCheckin')}</option>
            </select>
          </div>

          {/* Hidden native input, driven by the dropzone below. */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            aria-label={t('custodyDocument.chooseFile')}
            onChange={onFilePicked}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors cursor-pointer ${
              dragging
                ? 'border-primary bg-primary/5'
                : 'border-border bg-surface-alt hover:border-primary hover:bg-primary/5'
            }`}
          >
            <svg
              className="h-8 w-8 text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
              />
            </svg>
            {selectedFileName ? (
              <span className="text-sm font-medium text-foreground break-all">{selectedFileName}</span>
            ) : (
              <span className="text-sm text-muted">{t('custodyDocument.dropzone')}</span>
            )}
            <span className="text-xs text-muted">{t('custodyDocument.uploadHint')}</span>
          </button>

          <input
            type="text"
            className="w-full px-3 py-2 border border-border rounded bg-input text-foreground"
            placeholder={t('custodyDocument.notesPlaceholder')}
            value={uploadNotes}
            onChange={(e) => setUploadNotes(e.target.value)}
          />
          <Button onClick={() => void submitUpload()} disabled={busy || !selectedFileName}>
            {busy ? t('custodyDocument.uploading') : t('custodyDocument.upload')}
          </Button>
        </div>

        {/* Document list */}
        <div>
          <p className="font-medium mb-1">{t('custodyDocument.historyTitle')}</p>
          {documents.length === 0 ? (
            <p className="text-muted">{t('custodyDocument.none')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {typeLabel(doc.type)} · <span className="text-muted">{doc.originalFilename}</span>
                    </div>
                    <div className="text-xs text-muted">
                      {t('custodyDocument.colUploadedAt')}: {new Date(doc.dateCreated).toLocaleString()}
                      {doc.uploadedByName ? ` · ${doc.uploadedByName}` : ''}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="tertiary" onClick={() => void openPreview(doc)} disabled={busy}>
                      {t('custodyDocument.preview')}
                    </Button>
                    <Button variant="tertiary" onClick={() => void downloadDoc(doc)} disabled={busy}>
                      {t('custodyDocument.download')}
                    </Button>
                    <Button variant="danger" onClick={() => void deleteDoc(doc)} disabled={busy}>
                      {t('custodyDocument.delete')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
  );

  return (
    <>
      {embedded ? (
        body
      ) : (
        <Panel title={t('custodyDocument.title')} className="mt-6">
          {body}
        </Panel>
      )}

      {/* Generate dialog */}
      <Modal
        isOpen={genOpen}
        onClose={() => setGenOpen(false)}
        title={t('custodyDocument.generateDialogTitle')}
      >
        <div className="space-y-4 text-sm">
          <div>
            <label className="block font-medium mb-1">{t('custodyDocument.type')}</label>
            <div className="text-muted">{typeLabel(genType)}</div>
          </div>
          <div>
            <label className="block font-medium mb-1">{t('custodyDocument.condition')}</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-border rounded bg-input text-foreground"
              placeholder={t('custodyDocument.conditionPlaceholder')}
              value={genCondition}
              onChange={(e) => setGenCondition(e.target.value)}
            />
          </div>
          <div>
            <label className="block font-medium mb-1">{t('custodyDocument.accessories')}</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-border rounded bg-input text-foreground"
              placeholder={t('custodyDocument.accessoriesPlaceholder')}
              value={genAccessories}
              onChange={(e) => setGenAccessories(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="tertiary" onClick={() => setGenOpen(false)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void submitGenerate()} disabled={busy}>
              {busy ? t('custodyDocument.generating') : t('custodyDocument.generate')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Preview modal */}
      <Modal
        isOpen={previewUrl !== null}
        onClose={closePreview}
        title={t('custodyDocument.previewTitle')}
        size="lg"
      >
        {previewUrl ? (
          <div className="space-y-3">
            <iframe
              title={t('custodyDocument.previewTitle')}
              src={previewUrl}
              className="w-full h-[70vh] border border-border rounded"
            />
            <div className="flex justify-end">
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                {t('custodyDocument.openNewTab')}
              </a>
            </div>
          </div>
        ) : (
          <p className="text-muted">{t('custodyDocument.previewUnavailable')}</p>
        )}
      </Modal>
    </>
  );
}
