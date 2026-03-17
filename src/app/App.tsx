import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { LensType, ViewState } from '@/shared/types/domain';
import { safeText } from '@/lib/utils';
import { AppContext } from '@/contexts/AppContext';
import type { ToastItem } from '@/shared/components/ToastList';
import { ToastList } from '@/shared/components/ToastList';
import { LensesView, HistoryView, useDateFilter } from '@/features/expenses';
import { RulesView } from '@/features/rules';
import { CategoriesManager } from '@/features/categories';
import { SettingsView } from '@/features/settings';
import { useSyncEngine } from '@/features/sync';
import { useAuth } from '@/shared/hooks/useAuth';
import { useAppData } from '@/shared/hooks/useAppData';

const CLIENT_ID = '493268705547-fnbs5b5op3e9km8mptiimck61opiuot8.apps.googleusercontent.com';

// ─── APP ──────────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  // ─── TOAST SYSTEM ──────────────────────────────────────────────────────────
  const [toasts, setToasts]   = useState<ToastItem[]>([]);
  const toastCounter          = useRef(0);

  const addToast = useCallback((message: string, type: ToastItem['type']) => {
    const id = ++toastCounter.current;
    setToasts(prev => [...prev.slice(-2), { id, message, type }]); // max 3
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const toast = useMemo(() => ({
    success: (msg: string) => addToast(msg, 'success'),
    error:   (msg: string) => addToast(msg, 'error'),
    info:    (msg: string) => addToast(msg, 'info'),
  }), [addToast]);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ─── AUTH ────────────────────────────────────────────────────────────────────
  const { token, dbId, appState, handleLogout, handleReconnect } = useAuth(CLIENT_ID, toast);

  // ─── VIEW STATE ──────────────────────────────────────────────────────────────
  const [currentView, setCurrentView] = useState<ViewState>('LENSES');
  const [currentLens, setCurrentLens] = useState<LensType>('products');
  const { dateRange, setDateRange }   = useDateFilter();

  // ─── DATA ────────────────────────────────────────────────────────────────────
  const { rawLines, history, rules, categories, categoryCounts, loadData } = useAppData(token, dbId, toast);

  useEffect(() => {
    if (appState === 'READY') loadData();
  }, [appState, loadData]);

  // ─── SYNC ────────────────────────────────────────────────────────────────────
  const { isSyncing, progressMsg, runSync } = useSyncEngine(token, loadData, toast);

  // ─── LOGIN ───────────────────────────────────────────────────────────────────
  if (appState === 'LOGIN') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-950">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 blur-[120px] rounded-full"></div>
        </div>
        <h1 className="text-8xl font-black text-white mb-4 tracking-tighter z-10">
          Omni<span className="text-emerald-400 italic">Ticket</span>
        </h1>
        <p className="text-slate-400 text-xl mb-12 max-w-md font-medium z-10 leading-relaxed">
          Analiza tus gastos con el poder de Gemini directamente desde tus tickets de Gmail.
        </p>
        <button
          onClick={handleReconnect}
          className="z-10 bg-white text-slate-950 px-12 py-5 rounded-full font-black text-xl hover:scale-105 transition-all shadow-2xl flex items-center space-x-4 active:scale-95"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span>Conectar Google Account</span>
        </button>
      </div>
    );
  }

  // ─── LOADING ─────────────────────────────────────────────────────────────────
  if (appState === 'LOADING') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950">
        <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin mb-8"></div>
        <p className="font-mono text-xs uppercase tracking-[0.5em] text-emerald-400/80 animate-pulse">{safeText(progressMsg)}</p>
      </div>
    );
  }

  // ─── MAIN (appState === 'READY') ─────────────────────────────────────────────
  const contextValue = {
    token: token!,
    dbId: dbId!,
    toast,
    loadData,
  };

  return (
    <AppContext.Provider value={contextValue}>
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-200">
        <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-12">
            <div
              className="text-white font-black text-2xl tracking-tighter cursor-pointer flex items-center"
              onClick={() => setCurrentView('LENSES')}
            >
              <div className="w-8 h-8 bg-emerald-500 rounded-lg mr-3 flex items-center justify-center text-slate-950 text-xs">O</div>
              OMNI
            </div>
            <nav className="hidden lg:flex items-center space-x-2">
              {(['LENSES', 'HISTORY', 'RULES', 'CATEGORIES', 'SETTINGS'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setCurrentView(v)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${currentView === v ? 'bg-white/10 text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                >
                  {v}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleReconnect}
              title="Renovar sesión de Google"
              className="px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/5 transition-all border border-white/5"
            >
              Reconectar
            </button>
            <button
              onClick={runSync}
              disabled={isSyncing}
              className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center space-x-2 ${isSyncing ? 'bg-slate-900 text-slate-700' : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-xl shadow-emerald-500/20'}`}
            >
              {isSyncing
                ? <div className="w-3 h-3 border-2 border-slate-700 border-t-transparent rounded-full animate-spin"></div>
                : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              }
              <span>{isSyncing ? 'Sincronizando...' : 'Sync Gmail'}</span>
            </button>
            <button
              onClick={handleLogout}
              className="p-3 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-2xl"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-12 max-w-7xl mx-auto w-full animate-fade-in">
          {currentView === 'LENSES' && (
            <LensesView
              currentLens={currentLens}
              setCurrentLens={setCurrentLens}
              rawLines={rawLines}
              dateRange={dateRange}
              setDateRange={setDateRange}
              rules={rules}
              categories={categories}
            />
          )}
          {currentView === 'HISTORY' && (
            <HistoryView history={history} />
          )}
          {currentView === 'RULES' && (
            <RulesView rules={rules} categories={categories} />
          )}
          {currentView === 'CATEGORIES' && (
            <CategoriesManager categories={categories} categoryCounts={categoryCounts} />
          )}
          {currentView === 'SETTINGS' && (
            <SettingsView onLogout={handleLogout} />
          )}
        </main>

        {/* Sync progress indicator */}
        {progressMsg && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-white text-slate-950 px-8 py-4 rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl flex items-center space-x-6 z-50 border border-emerald-500/20">
            <div className="w-5 h-5 border-[3px] border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
            <span className="translate-y-px">{safeText(progressMsg)}</span>
          </div>
        )}

        <ToastList toasts={toasts} onDismiss={dismissToast} />
      </div>
    </AppContext.Provider>
  );
};

export default App;
