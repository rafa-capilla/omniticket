import { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleAuthService } from '@/services/GoogleAuthService';
import { ConfigService } from '@/services/ConfigService';
import { getErrorMessage } from '@/lib/utils';
import { isAuthError } from '@/domain/errors';
import { TOKEN_REFRESH_CHECK_INTERVAL_MS } from '@/lib/constants';

type AppState = 'LOGIN' | 'LOADING' | 'READY';

interface UseAuthResult {
  token: string | null;
  dbId: string | null;
  appState: AppState;
  isBootstrapped: React.MutableRefObject<boolean>;
  handleLogout: () => void;
  handleReconnect: () => void;
  toast: { success: (msg: string) => void; error: (msg: string) => void; info: (msg: string) => void };
}

/**
 * Extracts authentication lifecycle logic from App.tsx.
 * Manages: OAuth init, token persistence, silent refresh, bootstrap, logout.
 */
export function useAuth(
  clientId: string,
  toast: { success: (msg: string) => void; error: (msg: string) => void; info: (msg: string) => void },
): UseAuthResult {
  const [token, setToken] = useState<string | null>(null);
  const [dbId, setDbId] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppState>('LOGIN');
  const isBootstrapped = useRef(false);

  // ─── AUTH INIT ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const savedToken = localStorage.getItem('google_access_token');
    const expiresAt = Number(localStorage.getItem('google_token_expires_at') || 0);
    const isExpired = !expiresAt || Date.now() >= expiresAt;

    GoogleAuthService.init((newToken) => setToken(newToken), clientId);

    if (savedToken && !isExpired) {
      setToken(savedToken);
    } else if (savedToken && isExpired) {
      GoogleAuthService.silentRefresh();
    }
  }, [clientId]);

  // Silent refresh check every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      if (GoogleAuthService.isTokenExpiringSoon()) {
        GoogleAuthService.silentRefresh();
      }
    }, TOKEN_REFRESH_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = useCallback(() => {
    GoogleAuthService.logout();
    isBootstrapped.current = false;
    setToken(null);
    setDbId(null);
    setAppState('LOGIN');
  }, []);

  const handleReconnect = useCallback(() => {
    GoogleAuthService.login();
  }, []);

  // ─── BOOTSTRAP ──────────────────────────────────────────────────────────────
  const bootstrapConfig = useCallback(async (accessToken: string) => {
    setAppState('LOADING');
    try {
      const config = new ConfigService(accessToken);
      const { dbId: id } = await config.ensureDatabase();
      setDbId(id);
      setAppState('READY');
      isBootstrapped.current = true;
    } catch (err: unknown) {
      if (isAuthError(err)) handleLogout();
      else {
        toast.error('Error al inicializar: ' + getErrorMessage(err));
        setAppState('LOGIN');
      }
    }
  }, [handleLogout, toast]);

  useEffect(() => {
    if (!token) { setAppState('LOGIN'); return; }
    if (isBootstrapped.current) return;
    bootstrapConfig(token);
  }, [token, bootstrapConfig]);

  return {
    token,
    dbId,
    appState,
    isBootstrapped,
    handleLogout,
    handleReconnect,
    toast,
  };
}
