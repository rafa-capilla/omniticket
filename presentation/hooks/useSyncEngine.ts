import { useState, useCallback } from 'react';
import { SyncEngine } from '../../services/SyncEngine';
import { safeText, getErrorMessage } from '../../lib/utils';

interface UseSyncEngineResult {
  isSyncing: boolean;
  progressMsg: string;
  runSync: () => Promise<void>;
}

/**
 * Encapsulates sync lifecycle: run SyncEngine, track progress, reload data on completion.
 * Extracted from App.tsx to reduce its responsibilities.
 */
export function useSyncEngine(
  token: string | null,
  loadData: () => Promise<void>,
  toast: { success: (msg: string) => void; error: (msg: string) => void },
): UseSyncEngineResult {
  const [isSyncing, setIsSyncing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  const runSync = useCallback(async () => {
    if (!token) return;
    setIsSyncing(true);
    try {
      const engine = new SyncEngine(token);
      await engine.runSync(msg => setProgressMsg(safeText(msg)));
      await loadData();
      toast.success('Sincronización completada.');
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      if (msg === '401') {
        toast.error('Sesión expirada. Haz clic en "Reconectar" para continuar.');
      } else {
        toast.error('Error en sync: ' + msg);
      }
    } finally {
      setIsSyncing(false);
      setProgressMsg('');
    }
  }, [token, loadData, toast]);

  return { isSyncing, progressMsg, runSync };
}
