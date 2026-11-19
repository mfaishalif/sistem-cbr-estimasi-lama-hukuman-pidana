import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, DialogClose } from '@/components/ui/dialog';
import { Sheet } from '@/components/ui/sheet';
import { api, ApiError, type CaseUnit } from '@/lib/api';
import { copy } from '@/lib/copy';
import { notifyIndexChanged } from '@/lib/index-status';
import { CaseDetailView } from './CaseDetailView';
import { CaseEditor } from './CaseEditor';

interface CaseDrawerProps {
  caseId: string | null;
  onClose: () => void;
  onChanged: () => void;
}

/** Deep-linkable detail drawer (`#kasus/<id>`) with edit and delete. */
export function CaseDrawer({ caseId, onClose, onChanged }: CaseDrawerProps) {
  const [unit, setUnit] = useState<CaseUnit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    setUnit(null);
    setError(null);
    try {
      setUnit(await api.getCase(id));
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 404
          ? 'Perkara ini tidak ditemukan. Mungkin sudah dihapus; kembali ke daftar untuk memilih perkara lain.'
          : `Detail perkara tidak dapat dimuat: ${caught instanceof Error ? caught.message : 'server tidak menjawab'}.`,
      );
    }
  }, []);

  useEffect(() => {
    setEditing(false);
    setConfirmDelete(false);
    if (caseId !== null) void load(caseId);
  }, [caseId, load]);

  const remove = async () => {
    if (unit === null) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteCase(unit.id);
      notifyIndexChanged();
      setConfirmDelete(false);
      onChanged();
      onClose();
    } catch (caught) {
      setDeleteError(`Perkara belum terhapus: ${caught instanceof Error ? caught.message : 'server tidak menjawab'}. Coba lagi.`);
    } finally {
      setDeleting(false);
    }
  };

  const updated = (saved: CaseUnit) => {
    setUnit(saved);
    onChanged();
  };

  return (
    <>
      <Sheet
        open={caseId !== null && !editing}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={unit?.identity.caseNumber ?? 'Detail perkara'}
        description={unit?.identity.court}
        footer={
          unit === null ? undefined : (
            <div className="flex flex-wrap justify-between gap-3">
              <Button onClick={() => setEditing(true)}>{copy.cases.edit}</Button>
              <Button variant="ghost" className="text-danger hover:text-danger" onClick={() => setConfirmDelete(true)}>
                {copy.cases.remove}
              </Button>
            </div>
          )
        }
      >
        {error !== null ? (
          <div role="alert" className="space-y-4">
            <p className="text-[15px] text-ink">{error}</p>
            <Button onClick={() => caseId !== null && void load(caseId)}>{copy.result.retry}</Button>
          </div>
        ) : unit === null ? (
          <div className="space-y-3" aria-busy>
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-5 animate-pulse rounded-sm bg-surface-sunken" style={{ width: `${90 - item * 15}%` }} />
            ))}
          </div>
        ) : (
          <CaseDetailView unit={unit} onUnitChange={updated} />
        )}
      </Sheet>

      {unit === null ? null : (
        <CaseEditor
          open={editing}
          onOpenChange={setEditing}
          unit={unit}
          onSaved={(saved) => {
            setEditing(false);
            updated(saved);
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={copy.cases.deleteTitle}
        description={
          <>
            Perkara <span className="tabular font-medium text-ink">{unit?.identity.caseNumber}</span> beserta putusannya dihapus dari
            basis kasus dan tidak lagi dipakai sebagai putusan serupa. Tindakan ini tidak dapat dibatalkan.
            {deleteError === null ? null : <span className="mt-2 block font-medium text-danger">{deleteError}</span>}
          </>
        }
      >
        <DialogClose asChild>
          <Button disabled={deleting}>{copy.actual.cancel}</Button>
        </DialogClose>
        <Button variant="danger" onClick={() => void remove()} disabled={deleting}>
          {deleting ? 'Menghapus…' : copy.cases.deleteConfirm}
        </Button>
      </ConfirmDialog>
    </>
  );
}
