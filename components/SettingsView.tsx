import React, { useState, useEffect } from 'react';
import { ConfigService } from '../services/ConfigService';
import { useApp } from '../contexts/AppContext';
import { safeText, getErrorMessage } from '../lib/utils';

interface Props {
  onLogout: () => void;
}

export const SettingsView: React.FC<Props> = ({ onLogout }) => {
  const { token, dbId, toast, loadData } = useApp();

  const [settings, setSettings] = useState({
    GMAIL_SEARCH_LABEL: '',
    GMAIL_PROCESSED_LABEL: '',
    GEMINI_API_KEY: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const config = new ConfigService(token);
    config.getSettings(dbId).then(s => {
      setSettings({
        GMAIL_SEARCH_LABEL: s.GMAIL_SEARCH_LABEL,
        GMAIL_PROCESSED_LABEL: s.GMAIL_PROCESSED_LABEL,
        GEMINI_API_KEY: s.GEMINI_API_KEY,
      });
      setLoaded(true);
    }).catch((err: unknown) => {
      console.error('[SettingsView] getSettings failed:', err);
      toast.error('Error al cargar la configuración: ' + getErrorMessage(err));
    });
  }, [token, dbId, toast]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const config = new ConfigService(token);
      await Promise.all([
        config.updateSetting('GMAIL_SEARCH_LABEL', settings.GMAIL_SEARCH_LABEL),
        config.updateSetting('GMAIL_PROCESSED_LABEL', settings.GMAIL_PROCESSED_LABEL),
        config.updateSetting('GEMINI_API_KEY', settings.GEMINI_API_KEY),
      ]);
      await loadData();
      toast.success('Ajustes guardados.');
    } catch (err: unknown) {
      toast.error('Error al guardar: ' + getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-12">
      <div className="text-center">
        <h2 className="text-6xl font-black tracking-tighter uppercase text-white mb-4">Ajustes</h2>
        <p className="text-slate-500 font-medium uppercase text-[10px] tracking-[0.4em]">OmniTicket Pro Edition</p>
      </div>
      <div className="bg-white/[0.02] border border-white/5 p-12 rounded-[4rem] space-y-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl -mr-16 -mt-16"></div>

        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-4">Conectado a Google Sheets</label>
          <div className="bg-slate-900 border border-white/5 px-8 py-6 rounded-3xl font-mono text-xs text-emerald-500/80 break-all leading-relaxed">{dbId}</div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-4">Gemini AI</label>
          <div className="bg-slate-900/50 border border-white/5 px-8 py-6 rounded-3xl flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Motor de IA</span>
            <span className="text-[9px] font-black uppercase px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">Gemini 2.5 Pro</span>
          </div>
        </div>

        {loaded && (
          <>
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-4">Label de búsqueda Gmail</label>
              <input
                value={settings.GMAIL_SEARCH_LABEL}
                onChange={e => setSettings(s => ({ ...s, GMAIL_SEARCH_LABEL: e.target.value }))}
                className="w-full bg-slate-900 border border-white/5 px-8 py-5 rounded-3xl text-xs text-white outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-4">Label de procesados Gmail</label>
              <input
                value={settings.GMAIL_PROCESSED_LABEL}
                onChange={e => setSettings(s => ({ ...s, GMAIL_PROCESSED_LABEL: e.target.value }))}
                className="w-full bg-slate-900 border border-white/5 px-8 py-5 rounded-3xl text-xs text-white outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-4">Gemini API Key</label>
              <input
                type="password"
                value={settings.GEMINI_API_KEY}
                onChange={e => setSettings(s => ({ ...s, GEMINI_API_KEY: e.target.value }))}
                placeholder="AIza..."
                className="w-full bg-slate-900 border border-white/5 px-8 py-5 rounded-3xl text-xs text-white outline-none focus:border-emerald-500/50 transition-all placeholder:text-slate-700"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-5 bg-emerald-500 text-slate-950 font-black uppercase text-[11px] tracking-widest rounded-3xl hover:bg-emerald-400 transition-all disabled:opacity-50"
            >
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </>
        )}

        <button
          onClick={onLogout}
          className="w-full py-6 text-red-500/50 font-black uppercase text-[11px] tracking-widest border border-red-500/10 rounded-3xl hover:bg-red-500/5 transition-all"
        >
          Cerrar Sesión y Desvincular
        </button>
      </div>
      <div className="text-center text-slate-800 text-[8px] font-black uppercase tracking-[1em]">Secure End-to-End Analytics</div>
    </div>
  );
};
