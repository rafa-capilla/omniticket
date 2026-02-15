import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GoogleAuthService } from './services/GoogleAuthService';
import { SyncEngine } from './services/SyncEngine';
import { ConfigService } from './services/ConfigService';
import { SheetsService } from './services/SheetsService';
import { NormalizationService } from './services/NormalizationService';
import { OmniSettings, HistoryTicket, LensType, Rule, DashboardStats } from './types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, AreaChart, Area } from 'recharts';

const CLIENT_ID = '493268705547-fnbs5b5op3e9km8mptiimck61opiuot8.apps.googleusercontent.com';
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

const safeText = (val: any): string => (val === null || val === undefined) ? '' : String(val);
const safeNum = (val: any): number => {
  if (typeof val === 'number') return val;
  const cleanStr = String(val || '0').replace(/\s/g, '').replace(',', '.').replace(/[^-0-9.]/g, '');
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
};

// --- INTERFACES ---
interface LensesProps {
  currentLens: LensType;
  setCurrentLens: (lens: LensType) => void;
  rawLines: any[];
  dateRange: { start: string, end: string };
  setDateRange: React.Dispatch<React.SetStateAction<{ start: string, end: string }>>;
  isNormalizing: boolean;
  onRefreshIA: () => void;
  rules: Rule[];
  mappings: Map<string, string>;
}

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [dbId, setDbId] = useState<string | null>(null);
  const [appState, setAppState] = useState<'LOGIN' | 'LOADING' | 'READY'>('LOGIN');
  const [currentView, setCurrentView] = useState<string>('LENSES');
  const [currentLens, setCurrentLens] = useState<LensType>('products');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [history, setHistory] = useState<HistoryTicket[]>([]);
  const [rawLines, setRawLines] = useState<any[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [mappings, setMappings] = useState<Map<string, string>>(new Map());
  const [newRule, setNewRule] = useState<Rule>({ pattern: '', normalized: '', category: 'Otros' });

  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  });

  useEffect(() => {
    GoogleAuthService.init((newToken) => setToken(newToken), CLIENT_ID);
  }, []);

  const handleLogout = useCallback(() => {
    GoogleAuthService.logout();
    setToken(null);
    setAppState('LOGIN');
  }, []);

  const bootstrapConfig = useCallback(async (accessToken: string) => {
    setAppState('LOADING');
    try {
      const config = new ConfigService(accessToken);
      const { dbId: id } = await config.ensureDatabase();
      setDbId(id);
      setAppState('READY');
    } catch (err: any) {
      if (err.message === '401') handleLogout();
      else setProgressMsg("Error: " + safeText(err.message));
    }
  }, [handleLogout]);

  useEffect(() => {
    if (token) bootstrapConfig(token);
    else setAppState('LOGIN');
  }, [token, bootstrapConfig]);

  const loadData = async () => {
    if (!token || !dbId) return;
    const sheets = new SheetsService(token);
    try {
      const [lines, hist, m, r] = await Promise.all([
        sheets.fetchAllLineItems(dbId),
        sheets.fetchHistory(dbId),
        sheets.getMappings(dbId),
        sheets.getRules(dbId)
      ]);
      setRawLines(lines);
      setHistory(hist);
      setRules(r);
      const map = new Map<string, string>();
      m.forEach(item => map.set(safeText(item.original), safeText(item.simplificado)));
      setMappings(map);
    } catch (err) {
      console.error("Error al cargar datos", err);
    }
  };

  const runSync = async () => {
    if (!token) return;
    setIsSyncing(true);
    try {
      const engine = new SyncEngine(token);
      await engine.runSync(msg => setProgressMsg(safeText(msg)));
      await loadData();
    } catch (err: any) { 
      alert("Error Sync: " + safeText(err.message)); 
    } finally { 
      setIsSyncing(false); 
      setProgressMsg(""); 
    }
  };

  const handleRefreshIA = async () => {
    if (!token || !dbId) return;
    setIsNormalizing(true);
    setProgressMsg("Gemini está normalizando tus productos...");
    try {
      const sheets = new SheetsService(token);
      const norm = new NormalizationService(sheets, dbId, "");
      const uniqueNames = Array.from(new Set(rawLines.map(l => safeText(l[3] || ''))))
        .filter(n => n && n !== '--- TOTAL TICKET ---');
      const map = await norm.normalizeProducts(uniqueNames as string[]);
      setMappings(map);
      await loadData();
    } catch (err: any) {
      alert("Error IA: " + safeText(err.message));
    } finally {
      setIsNormalizing(false);
      setProgressMsg("");
    }
  };

  useEffect(() => {
    if (appState === 'READY') loadData();
  }, [appState]);

  if (appState === 'LOGIN') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-950">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 blur-[120px] rounded-full"></div>
        </div>
        <h1 className="text-8xl font-black text-white mb-4 tracking-tighter z-10">Omni<span className="text-emerald-400 italic">Ticket</span></h1>
        <p className="text-slate-400 text-xl mb-12 max-w-md font-medium z-10 leading-relaxed">Analiza tus gastos con el poder de Gemini directamente desde tus tickets de Gmail.</p>
        <button onClick={() => GoogleAuthService.login()} className="z-10 bg-white text-slate-950 px-12 py-5 rounded-full font-black text-xl hover:scale-105 transition-all shadow-2xl flex items-center space-x-4 active:scale-95">
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

  if (appState === 'LOADING') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950">
        <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin mb-8"></div>
        <p className="font-mono text-xs uppercase tracking-[0.5em] text-emerald-400/80 animate-pulse">{safeText(progressMsg)}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-200">
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-12">
          <div className="text-white font-black text-2xl tracking-tighter cursor-pointer flex items-center" onClick={() => setCurrentView('LENSES')}>
            <div className="w-8 h-8 bg-emerald-500 rounded-lg mr-3 flex items-center justify-center text-slate-950 text-xs">O</div>
            OMNI
          </div>
          <nav className="hidden lg:flex items-center space-x-2">
            {['LENSES', 'HISTORY', 'RULES', 'SETTINGS'].map(v => (
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
        <div className="flex items-center space-x-4">
          <button onClick={runSync} disabled={isSyncing} className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center space-x-2 ${isSyncing ? 'bg-slate-900 text-slate-700' : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-xl shadow-emerald-500/20'}`}>
            {isSyncing ? <div className="w-3 h-3 border-2 border-slate-700 border-t-transparent rounded-full animate-spin"></div> : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
            <span>{isSyncing ? 'Sincronizando...' : 'Sync Gmail'}</span>
          </button>
          <button onClick={handleLogout} className="p-3 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-2xl">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
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
            isNormalizing={isNormalizing}
            onRefreshIA={handleRefreshIA}
            rules={rules}
            mappings={mappings}
          />
        )}
        {currentView === 'HISTORY' && <HistoryView history={history} />}
        {currentView === 'RULES' && (
          <RulesView 
            rules={rules}
            newRule={newRule}
            setNewRule={setNewRule}
            onAddRule={async () => {
              if (!token || !dbId) return;
              const sheets = new SheetsService(token);
              await sheets.addRule(dbId, newRule);
              setNewRule({ pattern: '', normalized: '', category: 'Otros' });
              await loadData();
            }}
          />
        )}
        {currentView === 'SETTINGS' && <SettingsView dbId={dbId} onLogout={handleLogout} />}
      </main>

      {progressMsg && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-white text-slate-950 px-8 py-4 rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl flex items-center space-x-6 z-50 border border-emerald-500/20">
           <div className="w-5 h-5 border-[3px] border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
           <span className="translate-y-px">{safeText(progressMsg)}</span>
        </div>
      )}
    </div>
  );
};

// --- COMPONENTES DE VISTA ---

const LensesView: React.FC<LensesProps> = ({ 
  currentLens, setCurrentLens, rawLines, dateRange, setDateRange, isNormalizing, onRefreshIA, rules, mappings 
}) => {
  const processedData = useMemo(() => {
    return rawLines
      .filter((row: any) => {
        const date = safeText(row[2] || '');
        return date >= dateRange.start && date <= dateRange.end;
      })
      .map((row: any) => {
        const originalName = safeText(row[3] || '');
        if (originalName === '--- TOTAL TICKET ---' || !originalName) return row;
        const matchedRule = rules.find((r: any) => originalName.toLowerCase().includes(safeText(r.pattern).toLowerCase()));
        let normalizedName = originalName;
        let category = safeText(row[4] || 'Otros');
        if (matchedRule) {
          normalizedName = safeText(matchedRule.normalized);
          category = safeText(matchedRule.category);
        } else {
          const cached = mappings.get(originalName);
          if (cached) normalizedName = safeText(cached);
        }
        const newRow = [...row];
        newRow[3] = normalizedName;
        newRow[4] = category;
        return newRow;
      });
  }, [rawLines, dateRange, rules, mappings]);

  const stats: DashboardStats = useMemo(() => {
    let total = 0;
    let count = 0;
    const catMap = new Map<string, number>();
    
    processedData.forEach((row: any) => {
      if (safeText(row[3]) === '--- TOTAL TICKET ---') {
        total += safeNum(row[8]);
        count++;
      } else {
        const cat = safeText(row[4]);
        catMap.set(cat, (catMap.get(cat) || 0) + safeNum(row[8]));
      }
    });

    let topCat = "Ninguna";
    let maxVal = -1;
    catMap.forEach((v, k) => {
      if (v > maxVal) { maxVal = v; topCat = k; }
    });

    return {
      totalSpent: total,
      avgTicket: count > 0 ? total / count : 0,
      topCategory: topCat,
      ticketCount: count
    };
  }, [processedData]);

  const lensData = useMemo(() => {
    const agg = new Map<string, number>();
    processedData.forEach((row: any) => {
      let key = '';
      if (currentLens === 'products') key = safeText(row[3]);
      else if (currentLens === 'categories') key = safeText(row[4]);
      else if (currentLens === 'stores') key = safeText(row[1]);

      if (safeText(row[3]) === '--- TOTAL TICKET ---' || !key) return;
      agg.set(key, (agg.get(key) || 0) + safeNum(row[8]));
    });

    return Array.from(agg.entries())
      .map(([name, value]) => ({ name: String(name), value: Number(value) }))
      .sort((a, b) => b.value - a.value);
  }, [processedData, currentLens]);

  return (
    <div className="space-y-8">
      {/* Resumen de KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Gasto Total', value: `${stats.totalSpent.toFixed(2)}€`, icon: '💰' },
          { label: 'Ticket Promedio', value: `${stats.avgTicket.toFixed(2)}€`, icon: '🧾' },
          { label: 'Top Categoría', value: stats.topCategory, icon: '🏷️' },
          { label: 'Tickets Procesados', value: stats.ticketCount, icon: '📦' }
        ].map((kpi, idx) => (
          <div key={idx} className="bg-white/[0.03] border border-white/5 p-6 rounded-[2rem] flex flex-col justify-between">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center">
              <span className="mr-2 opacity-60">{kpi.icon}</span>
              {kpi.label}
            </div>
            <div className="text-3xl font-black text-white tracking-tighter">{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-white/[0.02] border border-white/5 p-4 rounded-[2.5rem]">
         <div className="flex p-1.5 bg-slate-900 rounded-2xl">
            {['products', 'categories', 'stores'].map(lens => (
              <button 
                key={lens} 
                onClick={() => setCurrentLens(lens as LensType)} 
                className={`px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${currentLens === lens ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white'}`}
              >
                {lens}
              </button>
            ))}
         </div>
         <div className="flex items-center space-x-6 bg-slate-900 px-6 py-3 rounded-2xl">
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase text-slate-500 tracking-tighter mb-1">Desde</span>
              <input type="date" value={dateRange.start} onChange={e => setDateRange(r => ({...r, start: safeText(e.target.value)}))} className="bg-transparent text-[11px] font-mono text-emerald-400 outline-none" />
            </div>
            <div className="text-slate-800 font-bold">|</div>
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase text-slate-500 tracking-tighter mb-1">Hasta</span>
              <input type="date" value={dateRange.end} onChange={e => setDateRange(r => ({...r, end: safeText(e.target.value)}))} className="bg-transparent text-[11px] font-mono text-emerald-400 outline-none" />
            </div>
         </div>
         <button onClick={onRefreshIA} disabled={isNormalizing} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center space-x-3">
           <svg className={`w-4 h-4 ${isNormalizing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
           <span>{isNormalizing ? 'Normalizando...' : 'Refinar con Gemini'}</span>
         </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <div className="bg-white/[0.02] p-8 rounded-[3rem] border border-white/5 h-[500px] flex flex-col shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[80px] -mr-32 -mt-32"></div>
            <h3 className="text-[11px] font-black mb-8 uppercase tracking-widest text-slate-500 flex items-center">
              <div className="w-2 h-2 rounded-full bg-emerald-500 mr-3 animate-pulse"></div>
              Distribución por {String(currentLens)}
            </h3>
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {currentLens === 'categories' ? (
                  <PieChart>
                    <Pie data={lensData} cx="50%" cy="50%" innerRadius={100} outerRadius={140} paddingAngle={8} dataKey="value" stroke="none">
                      {lensData.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                    </Pie>
                    <Tooltip contentStyle={{backgroundColor: '#020617', border: 'none', borderRadius: '16px', fontSize: '10px', fontWeight: 'bold'}} itemStyle={{color: '#fff'}} cursor={{fill: 'transparent'}} />
                  </PieChart>
                ) : (
                  <BarChart data={lensData.slice(0, 10)} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={120} tick={{fill: '#475569', fontSize: 10, fontWeight: 700}} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{backgroundColor: '#020617', border: 'none', borderRadius: '16px', fontSize: '10px'}} cursor={{fill: 'rgba(255,255,255,0.03)'}} />
                    <Bar dataKey="value" fill="#10b981" radius={[0, 12, 12, 0]} barSize={24} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
         </div>
         <div className="bg-white/[0.01] p-8 rounded-[3rem] border border-white/5 overflow-y-auto custom-scrollbar h-[500px]">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-8">Listado Detallado</h3>
            <div className="space-y-3">
              {lensData.map((item, i) => (
                <div key={i} className="group bg-slate-900/50 p-6 rounded-2xl border border-white/5 flex justify-between items-center hover:border-emerald-500/30 transition-all cursor-default">
                  <div className="flex flex-col max-w-[70%]">
                    <span className="font-bold text-sm text-slate-300 truncate">{String(item.name)}</span>
                    <span className="text-[8px] uppercase tracking-wider text-slate-600 font-black mt-1">Impacto: {((item.value / stats.totalSpent) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="font-mono text-emerald-400 font-bold text-xl">{Number(item.value).toFixed(2)}€</div>
                </div>
              ))}
              {lensData.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50 py-20">
                  <div className="text-4xl mb-4">🏜️</div>
                  <p className="text-[10px] font-black uppercase tracking-widest">No hay datos en este rango</p>
                </div>
              )}
            </div>
         </div>
      </div>
    </div>
  );
};

const HistoryView: React.FC<{ history: HistoryTicket[] }> = ({ history }) => (
  <div className="space-y-10">
    <div className="flex items-center justify-between">
      <h2 className="text-5xl font-black tracking-tighter uppercase text-white">Tickets Recientes</h2>
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white/5 px-4 py-2 rounded-full">
        {history.length} Tickets Totales
      </div>
    </div>
    <div className="bg-white/[0.02] border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl">
      <table className="w-full text-left">
        <thead className="bg-slate-900/50 text-[10px] uppercase font-black tracking-[0.2em] text-slate-500 border-b border-white/5">
          <tr><th className="px-10 py-7">Fecha de Compra</th><th className="px-10 py-7">Establecimiento</th><th className="px-10 py-7 text-right">Monto Total</th></tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {history.map((t) => (
            <tr key={String(t.id)} className="group hover:bg-emerald-500/[0.03] transition-colors cursor-pointer">
              <td className="px-10 py-7 font-mono text-xs text-slate-500 group-hover:text-emerald-500/50 transition-colors">{String(t.fecha)}</td>
              <td className="px-10 py-7 font-black text-sm text-slate-200">{String(t.tienda)}</td>
              <td className="px-10 py-7 text-right font-black text-white text-2xl tracking-tighter">
                {Number(t.total).toFixed(2)}<span className="text-emerald-500 ml-1">€</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const RulesView: React.FC<{ rules: Rule[], newRule: Rule, setNewRule: (r: Rule) => void, onAddRule: () => void }> = ({ rules, newRule, setNewRule, onAddRule }) => (
  <div className="max-w-4xl mx-auto space-y-12">
    <div className="bg-white/[0.02] p-10 rounded-[3rem] border border-white/5">
      <h3 className="text-[11px] font-black uppercase tracking-widest text-emerald-400 mb-8 flex items-center">
        <span className="mr-3">⚡</span> Crear Nueva Regla de Categorización
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <input placeholder="Contiene..." value={newRule.pattern} onChange={e => setNewRule({...newRule, pattern: safeText(e.target.value)})} className="bg-slate-900 border border-white/5 rounded-2xl px-6 py-5 text-xs outline-none focus:border-emerald-500/50 focus:bg-slate-800 transition-all text-white placeholder:text-slate-700" />
        <input placeholder="Nombre Simple" value={newRule.normalized} onChange={e => setNewRule({...newRule, normalized: safeText(e.target.value)})} className="bg-slate-900 border border-white/5 rounded-2xl px-6 py-5 text-xs outline-none focus:border-emerald-500/50 focus:bg-slate-800 transition-all text-white placeholder:text-slate-700" />
        <select value={newRule.category} onChange={e => setNewRule({...newRule, category: safeText(e.target.value)})} className="bg-slate-900 border border-white/5 rounded-2xl px-6 py-5 text-xs outline-none text-slate-400 cursor-pointer appearance-none">
          {['Lácteos', 'Limpieza', 'Bebidas', 'Fruta/Verdura', 'Carne', 'Higiene', 'Otros'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={onAddRule} className="bg-white text-slate-950 font-black py-5 rounded-2xl text-[11px] uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all">Guardar Regla</button>
      </div>
    </div>
    <div className="bg-white/[0.01] border border-white/5 rounded-[3rem] overflow-hidden">
        <table className="w-full text-left">
          <tbody className="divide-y divide-white/5">
            {rules.map((r, i) => (
              <tr key={i} className="group hover:bg-white/[0.02]">
                <td className="px-10 py-6 font-mono text-xs text-slate-600 group-hover:text-slate-400">"{String(r.pattern)}"</td>
                <td className="px-10 py-6 font-black text-emerald-400">{String(r.normalized)}</td>
                <td className="px-10 py-6 text-[9px] uppercase font-black text-slate-800 group-hover:text-slate-600 transition-colors">{String(r.category)}</td>
              </tr>
            ))}
          </tbody>
        </table>
    </div>
  </div>
);

const SettingsView: React.FC<{ dbId: string | null, onLogout: () => void }> = ({ dbId, onLogout }) => (
  <div className="max-w-2xl mx-auto space-y-12">
    <div className="text-center">
      <h2 className="text-6xl font-black tracking-tighter uppercase text-white mb-4">Ajustes</h2>
      <p className="text-slate-500 font-medium uppercase text-[10px] tracking-[0.4em]">OmniTicket Pro Edition</p>
    </div>
    <div className="bg-white/[0.02] border border-white/5 p-12 rounded-[4rem] space-y-10 relative overflow-hidden shadow-2xl">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl -mr-16 -mt-16"></div>
      <div className="space-y-4">
        <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-4">Conectado a Google Sheets</label>
        <div className="bg-slate-900 border border-white/5 px-8 py-6 rounded-3xl font-mono text-xs text-emerald-500/80 break-all leading-relaxed">{String(dbId || 'No conectado')}</div>
      </div>
      <div className="space-y-4">
        <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest ml-4">Gemini Intelligence</label>
        <div className="bg-slate-900/50 border border-white/5 px-8 py-6 rounded-3xl flex items-center justify-between">
           <span className="text-xs font-bold text-slate-500">Estado del Motor IA</span>
           <span className="text-[9px] font-black uppercase px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">Activo (3.0 Pro)</span>
        </div>
      </div>
      <button onClick={onLogout} className="w-full py-6 text-red-500/50 font-black uppercase text-[11px] tracking-widest border border-red-500/10 rounded-3xl hover:bg-red-500/5 transition-all mt-8">Cerrar Sesión y Desvincular</button>
    </div>
    <div className="text-center text-slate-800 text-[8px] font-black uppercase tracking-[1em]">Secure End-to-End Analytics</div>
  </div>
);

export default App;
