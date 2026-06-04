import { useEffect, useState } from 'react';
import { api } from '~/utils/api';

/** Load an authenticated binary resource once per URL; shared across all mounted consumers. */
export function useObjectUrl(path: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setSrc(null);
      return;
    }

    setSrc(null);
    let active = true;
    void api.fetchObjectUrl(path).then((url) => {
      if (active) setSrc(url);
    });

    return () => {
      active = false;
      api.releaseObjectUrl(path);
    };
  }, [path]);

  return src;
}
