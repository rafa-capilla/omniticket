import { createContext, useContext } from 'react';

export interface ToastHelpers {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

export interface AppContextValue {
  /** Token OAuth activo. Siempre non-null dentro del árbol de la app autenticada. */
  token: string;
  /** ID del spreadsheet OmniTicket_DB del usuario. */
  dbId: string;
  /** Helpers para mostrar notificaciones toast. */
  toast: ToastHelpers;
  /** Recarga todos los datos desde Google Sheets. */
  loadData: () => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

/** Hook para consumir el contexto de la app. Lanza si se usa fuera del Provider. */
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro del AppContext.Provider');
  return ctx;
}
