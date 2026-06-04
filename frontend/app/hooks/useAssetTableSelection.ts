import { useCallback, useMemo, useState } from 'react';
import type { AssetSelectionItem } from '~/utils/qrPrint';

/**
 * Cross-page row selection for the assets list. Keeps the full {@link AssetSelectionItem}
 * for each selected row (not just its id) so consumers — QR print and the bulk-assign
 * wizard — can act on the selection after the user pages away from the original rows.
 */
export function useAssetTableSelection() {
  const [selected, setSelected] = useState<Map<string, AssetSelectionItem>>(() => new Map());

  const toggle = useCallback((item: AssetSelectionItem) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });
  }, []);

  const selectPage = useCallback((items: AssetSelectionItem[]) => {
    setSelected((prev) => {
      const next = new Map(prev);
      for (const item of items) next.set(item.id, item);
      return next;
    });
  }, []);

  const deselectPage = useCallback((ids: string[]) => {
    setSelected((prev) => {
      const next = new Map(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSelected(new Map());
  }, []);

  /** Removes a specific set of ids (e.g. the assets a bulk action succeeded for). */
  const remove = useCallback((ids: string[]) => {
    setSelected((prev) => {
      const next = new Map(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const count = selected.size;

  const items = useMemo(() => Array.from(selected.values()), [selected]);

  const pageSelectionState = useCallback(
    (pageIds: string[]) => {
      if (pageIds.length === 0) return { all: false, some: false };
      const selectedOnPage = pageIds.filter((id) => selected.has(id)).length;
      return {
        all: selectedOnPage === pageIds.length,
        some: selectedOnPage > 0 && selectedOnPage < pageIds.length,
      };
    },
    [selected],
  );

  return {
    toggle,
    selectPage,
    deselectPage,
    clear,
    remove,
    isSelected,
    count,
    items,
    pageSelectionState,
  };
}
