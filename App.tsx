import { useState, useEffect, useCallback, useMemo } from 'react';
import { GoogleAuthService } from './services/GoogleAuthService';
import { SyncEngine } from './services/SyncEngine';
import { ConfigService } from './services/ConfigService';
import { SheetsService } from './services/SheetsService';
import { AIAnalysisService } from './services/AIAnalysisService';
import {
  OmniSettings, HistoryTicket, LensType, Rule, DashboardStats,
  Category, AIAnalysisResult, AggregatedData
} from './types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

const CLIENT_ID = '493268705547-fnbs5b5op3e9km8mptiimck61opiuot8.apps.googleusercontent.com';
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

const safeText = (val: any): string => (val === null || val === undefined) ? '' : String(val);
const safeNum = (val: any): number => {
  if (typeof val === 'number') return val;
  const cleanStr = String(val || '0').replace(/\s/g, '').replace(',', '.').replace(/[^-0-9.]/g, '');
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
};

// ─── PROP INTERFACES ──────────────────────────────────────────────────────────

interface LensesProps {
  currentLens: LensType;
  setCurrentLens: (lens: LensType) => void;
  rawLines: any[];
  dateRange: { start: string; end: string };
  setDateRange: React.Dispatch<React.SetStateAction<{ start: string; end: string }>>;
  rules: Rule[];
  categories: Category[];
  token: string | null;
  dbId: string | null;
}

interface RulesViewProps {
  rules: Rule[];
  categories: Category[];
  newRule: Rule;
  setNewRule: (r: Rule) => void;
  onAddRule: () => void;
  onDeleteRule: (rowIndex: number) => void;
  onUpdateRule: (rowIndex: number, rule: Rule) => void;
}

interface CategoriesManagerProps {
  categories: Category[];
  categoryCounts: Map<string, number>;
  dbId: string | null;
  token: string | null;
  onUpdate: () => void;
}

// ─── APP ──────────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [dbId, setDbId] = useState<string | null>(null);
  const [appState, setAppState] = useState<'LOGIN' | 'LOADING' | 'READY'>('LOGIN');
  const [currentView, setCurrentView] = useState<string>('LENSES');
  const [currentLens, setCurrentLens] = useState<LensType>('products');
  const [isSyncing, setIsSyncing] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [history, setHistory] = useState<HistoryTicket[]>([]);
  const [rawLines, setRawLines] = useState<any[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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
    const savedToken = localStorage.getItem('google_access_token');
    if (savedToken) setToken(savedToken);
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

  const loadData = useCallback(async () => {
    if (!token || !dbId) return;
    const sheets = new SheetsService(token);
    try {
      const [lines, hist, r, cats] = await Promise.all([
        sheets.fetchAllLineItems(dbId),
        sheets.fetchHistory(dbId),
        sheets.getRules(dbId),
        sheets.getCategories(dbId)
      ]);
      setRawLines(lines);
      setHistory(hist as HistoryTicket[]);
      setRules(r as Rule[]);
      setCategories(cats as Category[]);
    } catch (err) {
      console.error("Error al cargar datos", err);
    }
  }, [token, dbId]);

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

  useEffect(() => {
    if (appState === 'READY') loadData();
  }, [appState, loadData]);

  // Category counts for delete confirmation
  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    rawLines.forEach((row: any[]) => {
      const name = safeText(row[3] || '');
      if (!name || name === '--- TOTAL TICKET ---') return;
      const cat = safeText(row[4] || '');
      if (cat) map.set(cat, (map.get(cat) || 0) + 1);
    });
    return map;
  }, [rawLines]);

  // ─── LOGIN ─────────────────────────────────────────────────────────────────
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

  // ─── LOADING ───────────────────────────────────────────────────────────────
  if (appState === 'LOADING') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950">
        <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin mb-8"></div>
        <p className="font-mono text-xs uppercase tracking-[0.5em] text-emerald-400/80 animate-pulse">{safeText(progressMsg)}</p>
      </div>
    );
  }

  // ─── MAIN ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-200">
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-12">
          <div className="text-white font-black text-2xl tracking-tighter cursor-pointer flex items-center" onClick={() => setCurrentView('LENSES')}>
            <div className="w-8 h-8 bg-emerald-500 rounded-lg mr-3 flex items-center justify-center text-slate-950 text-xs">O</div>
            OMNI
          </div>
          <nav className="hidden lg:flex items-center space-x-2">
            {['LENSES', 'HISTORY', 'RULES', 'CATEGORIES', 'SETTINGS'].map(v => (
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
            rules={rules}
            categories={categories}
            token={token}
            dbId={dbId}
          />
        )}
        {currentView === 'HISTORY' && <HistoryView history={history} />}
        {currentView === 'RULES' && (
          <RulesView
            rules={rules}
            categories={categories}
            newRule={newRule}
            setNewRule={setNewRule}
            onAddRule={async () => {
              if (!token || !dbId || !newRule.pattern || !newRule.normalized) return;
              const sheets = new SheetsService(token);
              await sheets.addRule(dbId, newRule);
              setNewRule({ pattern: '', normalized: '', category: categories.find(c => c.status === 'active')?.name || 'Otros' });
              await loadData();
            }}
            onDeleteRule={async (rowIndex) => {
              if (!token || !dbId) return;
              const sheets = new SheetsService(token);
              await sheets.deleteRule(dbId, rowIndex);
              await loadData();
            }}
            onUpdateRule={async (rowIndex, rule) => {
              if (!token || !dbId) return;
              const sheets = new SheetsService(token);
              await sheets.updateRule(dbId, rowIndex, rule);
              await loadData();
            }}
          />
        )}
        {currentView === 'CATEGORIES' && (
          <CategoriesManager
            categories={categories}
            categoryCounts={categoryCounts}
            dbId={dbId}
            token={token}
            onUpdate={loadData}
          />
        )}
        {currentView === 'SETTINGS' && (
          <SettingsView dbId={dbId} token={token} onLogout={handleLogout} onSaved={loadData} />
        )}
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

// ─── LENSES VIEW ──────────────────────────────────────────────────────────────

const LensesView: React.FC<LensesProps> = ({
  currentLens, setCurrentLens, rawLines, dateRange, setDateRange, rules, categories, token, dbId
}) => {
  const activeCategories = categories.filter(c => c.status === 'active');

  const processedData = useMemo(() => {
    return rawLines
      .filter((row: any) => {
        const date = safeText(row[2] || '');
        return date >= dateRange.start && date <= dateRange.end;
      })
      .map((row: any) => {
        const originalName = safeText(row[3] || '');
        if (originalName === '--- TOTAL TICKET ---' || !originalName) return row;

        // Priority: user rule > col J (normalizado from sync) > original
        const matchedRule = rules.find((r: any) =>
          originalName.toLowerCase().includes(safeText(r.pattern).toLowerCase())
        );
        const normalizedFromSync = safeText(row[9] || '');
        let normalizedName = normalizedFromSync || originalName;
        let category = safeText(row[4] || 'Otros');

        if (matchedRule) {
          normalizedName = safeText(matchedRule.normalized);
          category = safeText(matchedRule.category);
        }

        const newRow = [...row];
        newRow[3] = normalizedName;
        newRow[4] = category;
        return newRow;
      });
  }, [rawLines, dateRange, rules]);

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
    catMap.forEach((v, k) => { if (v > maxVal) { maxVal = v; topCat = k; } });

    return { totalSpent: total, avgTicket: count > 0 ? total / count : 0, topCategory: topCat, ticketCount: count };
  }, [processedData]);

  const lensData = useMemo(() => {
    if (currentLens === 'categories') {
      // Pre-seed all active categories with 0
      const agg = new Map<string, number>(
        activeCategories.map(c => [c.name, 0])
      );
      processedData.forEach((row: any) => {
        if (safeText(row[3]) === '--- TOTAL TICKET ---' || !safeText(row[3])) return;
        const key = safeText(row[4]);
        agg.set(key, (agg.get(key) || 0) + safeNum(row[8]));
      });
      return Array.from(agg.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    }

    const agg = new Map<string, number>();
    processedData.forEach((row: any) => {
      let key = '';
      if (currentLens === 'products') key = safeText(row[3]);
      else if (currentLens === 'stores') key = safeText(row[1]);
      if (safeText(row[3]) === '--- TOTAL TICKET ---' || !key) return;
      agg.set(key, (agg.get(key) || 0) + safeNum(row[8]));
    });

    return Array.from(agg.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [processedData, currentLens, activeCategories]);

  const lensLabels: Record<LensType, string> = {
    products: 'Productos',
    categories: 'Categorías',
    stores: 'Tiendas',
    analysis: 'Análisis'
  };

  return (
    <div className="space-y-8">
      {/* KPIs */}
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

      {/* Controls bar */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-white/[0.02] border border-white/5 p-4 rounded-[2.5rem]">
        <div className="flex p-1.5 bg-slate-900 rounded-2xl">
          {(['products', 'categories', 'stores', 'analysis'] as LensType[]).map(lens => (
            <button
              key={lens}
              onClick={() => setCurrentLens(lens)}
              className={`px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${currentLens === lens ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white'}`}
            >
              {lensLabels[lens]}
            </button>
          ))}
        </div>
        <div className="flex items-center space-x-6 bg-slate-900 px-6 py-3 rounded-2xl">
          <div className="flex flex-col">
            <span className="text-[8px] font-black uppercase text-slate-500 tracking-tighter mb-1">Desde</span>
            <input type="date" value={dateRange.start} onChange={e => setDateRange(r => ({ ...r, start: safeText(e.target.value) }))} className="bg-transparent text-[11px] font-mono text-emerald-400 outline-none" />
          </div>
          <div className="text-slate-800 font-bold">|</div>
          <div className="flex flex-col">
            <span className="text-[8px] font-black uppercase text-slate-500 tracking-tighter mb-1">Hasta</span>
            <input type="date" value={dateRange.end} onChange={e => setDateRange(r => ({ ...r, end: safeText(e.target.value) }))} className="bg-transparent text-[11px] font-mono text-emerald-400 outline-none" />
          </div>
        </div>
      </div>

      {/* Analysis lens */}
      {currentLens === 'analysis' && (
        <AIAnalysisView rawLines={rawLines} dateRange={dateRange} categories={activeCategories} token={token} dbId={dbId} />
      )}

      {/* Chart + table (hidden for analysis) */}
      {currentLens !== 'analysis' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white/[0.02] p-8 rounded-[3rem] border border-white/5 h-[500px] flex flex-col shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[80px] -mr-32 -mt-32"></div>
            <h3 className="text-[11px] font-black mb-8 uppercase tracking-widest text-slate-500 flex items-center">
              <div className="w-2 h-2 rounded-full bg-emerald-500 mr-3 animate-pulse"></div>
              Distribución por {lensLabels[currentLens]}
            </h3>
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {currentLens === 'categories' ? (
                  <PieChart>
                    <Pie data={lensData} cx="50%" cy="50%" innerRadius={100} outerRadius={140} paddingAngle={8} dataKey="value" stroke="none">
                      {lensData.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#020617', border: 'none', borderRadius: '16px', fontSize: '10px', fontWeight: 'bold' }} itemStyle={{ color: '#fff' }} cursor={{ fill: 'transparent' }} />
                  </PieChart>
                ) : (
                  <BarChart data={lensData.slice(0, 10)} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#020617', border: 'none', borderRadius: '16px', fontSize: '10px' }} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
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
                    <span className="text-[8px] uppercase tracking-wider text-slate-600 font-black mt-1">
                      Impacto: {stats.totalSpent > 0 ? ((item.value / stats.totalSpent) * 100).toFixed(1) : '0.0'}%
                    </span>
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
      )}
    </div>
  );
};

// ─── AI ANALYSIS VIEW ─────────────────────────────────────────────────────────

const AIAnalysisView: React.FC<{
  rawLines: any[];
  dateRange: { start: string; end: string };
  categories: Category[];
  token: string | null;
  dbId: string | null;
}> = ({ rawLines, dateRange, categories, token, dbId }) => {
  const [prompt, setPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AIAnalysisResult | null>(null);

  const aggregatedData = useMemo((): AggregatedData => {
    let totalSpent = 0;
    let ticketCount = 0;
    const catMap = new Map<string, number>();
    const prodMap = new Map<string, number>();
    const storeMap = new Map<string, number>();

    rawLines.forEach((row: any[]) => {
      const date = safeText(row[2] || '');
      if (date < dateRange.start || date > dateRange.end) return;

      if (safeText(row[3]) === '--- TOTAL TICKET ---') {
        totalSpent += safeNum(row[8]);
        ticketCount++;
      } else {
        const cat = safeText(row[4] || 'Otros');
        const prod = safeText(row[9] || '') || safeText(row[3] || '');
        const store = safeText(row[1] || '');
        const amount = safeNum(row[8]);
        catMap.set(cat, (catMap.get(cat) || 0) + amount);
        if (prod) prodMap.set(prod, (prodMap.get(prod) || 0) + amount);
        if (store) storeMap.set(store, (storeMap.get(store) || 0) + amount);
      }
    });

    // Pre-seed categories with 0
    categories.forEach(c => { if (!catMap.has(c.name)) catMap.set(c.name, 0); });

    return {
      period: dateRange,
      totalSpent,
      ticketCount,
      byCategory: Array.from(catMap.entries())
        .map(([name, total]) => ({ name, total, percentage: totalSpent > 0 ? (total / totalSpent) * 100 : 0 }))
        .sort((a, b) => b.total - a.total),
      byProduct: Array.from(prodMap.entries())
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total),
      byStore: Array.from(storeMap.entries())
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
    };
  }, [rawLines, dateRange, categories]);

  const handleAnalyze = async () => {
    if (!prompt.trim() || !token || !dbId) return;
    setIsAnalyzing(true);
    try {
      const config = new ConfigService(token);
      const settings = await config.getSettings();
      if (!settings.GEMINI_API_KEY) {
        alert("Configura tu GEMINI_API_KEY en la vista Settings primero");
        return;
      }
      const svc = new AIAnalysisService();
      const res = await svc.analyze(prompt, aggregatedData, settings.GEMINI_API_KEY);
      setResult(res);
    } catch (err: any) {
      alert("Error en análisis: " + safeText(err.message));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const examplePrompts = [
    "Divide mis gastos en esenciales vs no esenciales",
    "¿Qué productos podría eliminar para ahorrar?",
    "¿En qué tiendas gasto más y por qué?"
  ];

  return (
    <div className="space-y-8">
      <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[3rem]">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-emerald-400 mb-2 flex items-center">
          <span className="mr-3">✨</span> Análisis a la Carta con Gemini
        </h3>
        <p className="text-slate-600 text-xs mb-6">Haz cualquier pregunta sobre tus gastos del período seleccionado.</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {examplePrompts.map((ex, i) => (
            <button
              key={i}
              onClick={() => setPrompt(ex)}
              className="text-[10px] px-4 py-2 bg-slate-900 text-slate-500 hover:text-emerald-400 hover:bg-slate-800 rounded-xl border border-white/5 transition-all font-medium"
            >
              {ex}
            </button>
          ))}
        </div>

        <textarea
          placeholder="Escribe tu pregunta aquí..."
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          className="w-full bg-slate-900 border border-white/5 rounded-2xl px-6 py-5 text-sm text-white placeholder:text-slate-700 outline-none focus:border-emerald-500/50 resize-none h-28"
        />
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || !prompt.trim()}
          className="mt-4 bg-emerald-500 text-slate-950 px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center space-x-3"
        >
          {isAnalyzing && <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />}
          <span>{isAnalyzing ? 'Analizando...' : 'Analizar'}</span>
        </button>
      </div>

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white/[0.02] p-8 rounded-[3rem] border border-white/5">
            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-6 flex items-center">
              <div className="w-2 h-2 rounded-full bg-emerald-500 mr-3"></div>
              Análisis
            </h4>
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{result.analysis_text}</p>
          </div>
          <div className="bg-white/[0.02] p-8 rounded-[3rem] border border-white/5 h-[420px] flex flex-col">
            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-6 flex items-center">
              <div className="w-2 h-2 rounded-full bg-blue-500 mr-3"></div>
              {result.chart_title}
            </h4>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                {result.chart_type === 'pie' ? (
                  <PieChart>
                    <Pie data={result.chart_data} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={6} dataKey="value" stroke="none">
                      {result.chart_data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#020617', border: 'none', borderRadius: '16px', fontSize: '10px' }} itemStyle={{ color: '#fff' }} />
                  </PieChart>
                ) : (
                  <BarChart data={result.chart_data.slice(0, 10)} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={130} tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#020617', border: 'none', borderRadius: '16px', fontSize: '10px' }} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 12, 12, 0]} barSize={20} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── HISTORY VIEW ─────────────────────────────────────────────────────────────

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

// ─── RULES VIEW ───────────────────────────────────────────────────────────────

const RulesView: React.FC<RulesViewProps> = ({
  rules, categories, newRule, setNewRule, onAddRule, onDeleteRule, onUpdateRule
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Rule>({ pattern: '', normalized: '', category: 'Otros' });

  const activeCategories = categories.filter(c => c.status === 'active');
  const categoryOptions = activeCategories.length > 0
    ? activeCategories.map(c => c.name)
    : ['Lácteos', 'Carne', 'Fruta/Verdura', 'Limpieza', 'Bebidas', 'Higiene', 'Otros'];

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditForm({ ...rules[index] });
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    onUpdateRule(editingIndex + 2, editForm); // +2: row 1 = header, 0-indexed
    setEditingIndex(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      {/* Explanation */}
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl px-8 py-6">
        <p className="text-xs text-slate-400 leading-relaxed">
          Las reglas permiten corregir cómo OmniTicket categoriza tus productos. Si un producto contiene el patrón, se le asigna el nombre y categoría que definas — con mayor prioridad que la IA.
        </p>
        <p className="text-[10px] text-slate-600 mt-3 font-mono">
          Ej: patrón <span className="text-emerald-400">"agua con gas"</span> → nombre <span className="text-emerald-400">"Agua con Gas"</span>, categoría <span className="text-emerald-400">Bebidas</span>
        </p>
      </div>

      {/* Add rule form */}
      <div className="bg-white/[0.02] p-10 rounded-[3rem] border border-white/5">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-emerald-400 mb-8 flex items-center">
          <span className="mr-3">⚡</span> Crear Nueva Regla
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-black uppercase text-slate-600 tracking-widest ml-1">Patrón (contiene...)</label>
            <input
              placeholder="agua con gas"
              value={newRule.pattern}
              onChange={e => setNewRule({ ...newRule, pattern: safeText(e.target.value) })}
              className="bg-slate-900 border border-white/5 rounded-2xl px-6 py-5 text-xs outline-none focus:border-emerald-500/50 focus:bg-slate-800 transition-all text-white placeholder:text-slate-700"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-black uppercase text-slate-600 tracking-widest ml-1">Nombre normalizado</label>
            <input
              placeholder="Agua con Gas"
              value={newRule.normalized}
              onChange={e => setNewRule({ ...newRule, normalized: safeText(e.target.value) })}
              className="bg-slate-900 border border-white/5 rounded-2xl px-6 py-5 text-xs outline-none focus:border-emerald-500/50 focus:bg-slate-800 transition-all text-white placeholder:text-slate-700"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-black uppercase text-slate-600 tracking-widest ml-1">Categoría</label>
            <select
              value={newRule.category}
              onChange={e => setNewRule({ ...newRule, category: safeText(e.target.value) })}
              className="bg-slate-900 border border-white/5 rounded-2xl px-6 py-5 text-xs outline-none text-slate-400 cursor-pointer appearance-none"
            >
              {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-black uppercase text-slate-600 tracking-widest ml-1 opacity-0">.</label>
            <button
              onClick={onAddRule}
              disabled={!newRule.pattern || !newRule.normalized}
              className="bg-white text-slate-950 font-black py-5 rounded-2xl text-[11px] uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>

      {/* Rules table */}
      <div className="bg-white/[0.01] border border-white/5 rounded-[3rem] overflow-hidden">
        {rules.length === 0 ? (
          <div className="py-20 flex flex-col items-center text-slate-700 opacity-50">
            <div className="text-4xl mb-4">📋</div>
            <p className="text-[10px] font-black uppercase tracking-widest">Sin reglas definidas</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-900/50 text-[9px] uppercase font-black tracking-[0.2em] text-slate-600 border-b border-white/5">
              <tr>
                <th className="px-8 py-5">Patrón</th>
                <th className="px-8 py-5">Nombre Normalizado</th>
                <th className="px-8 py-5">Categoría</th>
                <th className="px-8 py-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rules.map((r, i) => (
                <tr key={i} className="group hover:bg-white/[0.02]">
                  {editingIndex === i ? (
                    <>
                      <td className="px-8 py-4">
                        <input
                          value={editForm.pattern}
                          onChange={e => setEditForm({ ...editForm, pattern: e.target.value })}
                          className="bg-slate-800 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-emerald-500/50 w-full"
                        />
                      </td>
                      <td className="px-8 py-4">
                        <input
                          value={editForm.normalized}
                          onChange={e => setEditForm({ ...editForm, normalized: e.target.value })}
                          className="bg-slate-800 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-emerald-500/50 w-full"
                        />
                      </td>
                      <td className="px-8 py-4">
                        <select
                          value={editForm.category}
                          onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                          className="bg-slate-800 border border-white/10 rounded-xl px-4 py-2 text-xs text-slate-300 outline-none appearance-none cursor-pointer"
                        >
                          {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-8 py-4 text-right space-x-2">
                        <button onClick={saveEdit} className="text-emerald-400 text-[10px] font-black uppercase tracking-widest hover:text-emerald-300 transition-colors">Guardar</button>
                        <button onClick={() => setEditingIndex(null)} className="text-slate-600 text-[10px] font-black uppercase tracking-widest hover:text-slate-400 transition-colors">Cancelar</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-8 py-5 font-mono text-xs text-slate-600 group-hover:text-slate-400">"{String(r.pattern)}"</td>
                      <td className="px-8 py-5 font-black text-emerald-400">{String(r.normalized)}</td>
                      <td className="px-8 py-5 text-[9px] uppercase font-black text-slate-600 group-hover:text-slate-500">{String(r.category)}</td>
                      <td className="px-8 py-5 text-right space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(i)} className="text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">Editar</button>
                        <button
                          onClick={() => { if (confirm(`¿Eliminar regla "${r.pattern}"?`)) onDeleteRule(i + 2); }}
                          className="text-red-500/50 hover:text-red-400 text-[10px] font-black uppercase tracking-widest transition-colors"
                        >
                          Borrar
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ─── CATEGORIES MANAGER ───────────────────────────────────────────────────────

const CategoriesManager: React.FC<CategoriesManagerProps> = ({
  categories, categoryCounts, dbId, token, onUpdate
}) => {
  const [newCat, setNewCat] = useState({ name: '', description: '' });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [deleteModal, setDeleteModal] = useState<{ index: number; name: string; replacement: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const activeCategories = categories.filter(c => c.status === 'active');

  const handleAdd = async () => {
    if (!newCat.name.trim() || !token || !dbId) return;
    setIsLoading(true);
    try {
      const sheets = new SheetsService(token);
      await sheets.addCategory(dbId, { name: newCat.name.trim(), description: newCat.description.trim(), status: 'active' });
      setNewCat({ name: '', description: '' });
      await onUpdate();
    } catch (err: any) {
      alert("Error al añadir: " + safeText(err.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (editingIndex === null || !token || !dbId) return;
    setIsLoading(true);
    try {
      const sheets = new SheetsService(token);
      const original = categories[editingIndex];
      const updated = { ...original, name: editForm.name.trim(), description: editForm.description.trim() };
      await sheets.updateCategory(dbId, editingIndex + 2, updated);
      setEditingIndex(null);
      await onUpdate();
    } catch (err: any) {
      alert("Error al editar: " + safeText(err.message));
    } finally {
      setIsLoading(false);
    }
  };

  const initiateDelete = (index: number, name: string) => {
    const count = categoryCounts.get(name) || 0;
    const others = activeCategories.filter(c => c.name !== name);
    const defaultReplacement = others.find(c => c.name === 'Otros')?.name || others[0]?.name || 'Otros';

    if (count === 0) {
      if (!confirm(`¿Eliminar la categoría "${name}"? No tiene productos asociados.`)) return;
      executeDelete(index, name, '');
    } else {
      setDeleteModal({ index, name, replacement: defaultReplacement });
    }
  };

  const executeDelete = async (index: number, name: string, replacement: string) => {
    if (!token || !dbId) return;
    setIsLoading(true);
    try {
      const sheets = new SheetsService(token);
      if (replacement) {
        await sheets.updateCategoryInGastos(dbId, name, replacement);
        // Update rules that reference this category
        const allRules = await sheets.getRules(dbId);
        for (let i = 0; i < allRules.length; i++) {
          if (allRules[i].category === name) {
            await sheets.updateRule(dbId, i + 2, { ...allRules[i], category: replacement });
          }
        }
      }
      await sheets.deleteCategory(dbId, index + 2);
      setDeleteModal(null);
      await onUpdate();
    } catch (err: any) {
      alert("Error al eliminar: " + safeText(err.message));
    } finally {
      setIsLoading(false);
    }
  };

  const categoryColors: Record<number, string> = {
    0: 'bg-emerald-500/20 text-emerald-400',
    1: 'bg-blue-500/20 text-blue-400',
    2: 'bg-amber-500/20 text-amber-400',
    3: 'bg-red-500/20 text-red-400',
    4: 'bg-purple-500/20 text-purple-400',
    5: 'bg-pink-500/20 text-pink-400',
    6: 'bg-indigo-500/20 text-indigo-400',
  };

  return (
    <div className="max-w-3xl mx-auto space-y-12">
      <div className="flex items-center justify-between">
        <h2 className="text-5xl font-black tracking-tighter uppercase text-white">Categorías</h2>
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white/5 px-4 py-2 rounded-full">
          {activeCategories.length} Activas
        </div>
      </div>

      {/* Add form */}
      <div className="bg-white/[0.02] p-10 rounded-[3rem] border border-white/5">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-emerald-400 mb-8 flex items-center">
          <span className="mr-3">➕</span> Nueva Categoría
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-black uppercase text-slate-600 tracking-widest ml-1">Nombre</label>
            <input
              placeholder="Panadería"
              value={newCat.name}
              onChange={e => setNewCat({ ...newCat, name: e.target.value })}
              className="bg-slate-900 border border-white/5 rounded-2xl px-6 py-5 text-xs outline-none focus:border-emerald-500/50 focus:bg-slate-800 transition-all text-white placeholder:text-slate-700"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-black uppercase text-slate-600 tracking-widest ml-1">Descripción</label>
            <input
              placeholder="Pan, bollería, pasteles..."
              value={newCat.description}
              onChange={e => setNewCat({ ...newCat, description: e.target.value })}
              className="bg-slate-900 border border-white/5 rounded-2xl px-6 py-5 text-xs outline-none focus:border-emerald-500/50 focus:bg-slate-800 transition-all text-white placeholder:text-slate-700"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-black uppercase text-slate-600 tracking-widest ml-1 opacity-0">.</label>
            <button
              onClick={handleAdd}
              disabled={isLoading || !newCat.name.trim()}
              className="bg-white text-slate-950 font-black py-5 rounded-2xl text-[11px] uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40"
            >
              {isLoading ? 'Guardando...' : 'Añadir'}
            </button>
          </div>
        </div>
      </div>

      {/* Categories list */}
      <div className="space-y-3">
        {categories.map((cat, i) => (
          <div key={i} className="group bg-white/[0.02] border border-white/5 rounded-3xl p-6 flex items-center justify-between hover:border-white/10 transition-all">
            {editingIndex === i ? (
              <div className="flex-1 grid grid-cols-2 gap-4 mr-4">
                <input
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-emerald-500/50"
                />
                <input
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  className="bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-emerald-500/50"
                />
              </div>
            ) : (
              <div className="flex items-center space-x-5 flex-1">
                <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${categoryColors[i % 7]}`}>
                  {cat.name}
                </span>
                <span className="text-slate-600 text-xs truncate max-w-xs">{cat.description}</span>
                {(categoryCounts.get(cat.name) || 0) > 0 && (
                  <span className="text-[9px] text-slate-700 font-mono">{categoryCounts.get(cat.name)} productos</span>
                )}
              </div>
            )}
            <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {editingIndex === i ? (
                <>
                  <button onClick={handleSaveEdit} disabled={isLoading} className="text-emerald-400 text-[10px] font-black uppercase tracking-widest hover:text-emerald-300 transition-colors px-2">Guardar</button>
                  <button onClick={() => setEditingIndex(null)} className="text-slate-600 text-[10px] font-black uppercase tracking-widest hover:text-slate-400 transition-colors px-2">Cancelar</button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setEditingIndex(i); setEditForm({ name: cat.name, description: cat.description }); }}
                    className="text-slate-600 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors px-2"
                  >
                    Editar
                  </button>
                  {cat.name !== 'Otros' && (
                    <button
                      onClick={() => initiateDelete(i, cat.name)}
                      className="text-red-500/40 hover:text-red-400 text-[10px] font-black uppercase tracking-widest transition-colors px-2"
                    >
                      Borrar
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-10 max-w-md w-full space-y-6 shadow-2xl">
            <h3 className="text-lg font-black text-white">¿Borrar categoría?</h3>
            <p className="text-sm text-slate-400">
              La categoría <span className="text-white font-bold">"{deleteModal.name}"</span> tiene{' '}
              <span className="text-amber-400 font-bold">{categoryCounts.get(deleteModal.name) || 0} productos</span> asociados.
              Elige una categoría de reemplazo:
            </p>
            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black uppercase text-slate-600 tracking-widest ml-1">Reasignar a</label>
              <select
                value={deleteModal.replacement}
                onChange={e => setDeleteModal({ ...deleteModal, replacement: e.target.value })}
                className="bg-slate-800 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white outline-none appearance-none cursor-pointer"
              >
                {activeCategories
                  .filter(c => c.name !== deleteModal.name)
                  .map(c => <option key={c.name} value={c.name}>{c.name}</option>)
                }
              </select>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => executeDelete(deleteModal.index, deleteModal.name, deleteModal.replacement)}
                disabled={isLoading}
                className="flex-1 bg-red-500 text-white font-black py-4 rounded-2xl text-[11px] uppercase tracking-widest hover:bg-red-400 disabled:opacity-50 transition-all"
              >
                {isLoading ? 'Procesando...' : 'Confirmar y Borrar'}
              </button>
              <button
                onClick={() => setDeleteModal(null)}
                className="flex-1 bg-white/5 text-slate-400 font-black py-4 rounded-2xl text-[11px] uppercase tracking-widest hover:bg-white/10 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── SETTINGS VIEW ────────────────────────────────────────────────────────────

const SettingsView: React.FC<{
  dbId: string | null;
  token: string | null;
  onLogout: () => void;
  onSaved: () => void;
}> = ({ dbId, token, onLogout, onSaved }) => {
  const [settings, setSettings] = useState<{
    GMAIL_SEARCH_LABEL: string;
    GMAIL_PROCESSED_LABEL: string;
    GEMINI_API_KEY: string;
  }>({ GMAIL_SEARCH_LABEL: '', GMAIL_PROCESSED_LABEL: '', GEMINI_API_KEY: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!token) return;
    const config = new ConfigService(token);
    config.getSettings().then(s => {
      setSettings({
        GMAIL_SEARCH_LABEL: s.GMAIL_SEARCH_LABEL,
        GMAIL_PROCESSED_LABEL: s.GMAIL_PROCESSED_LABEL,
        GEMINI_API_KEY: s.GEMINI_API_KEY,
      });
      setLoaded(true);
    }).catch(console.error);
  }, [token]);

  const handleSave = async () => {
    if (!token) return;
    setIsSaving(true);
    try {
      const config = new ConfigService(token);
      await Promise.all([
        config.updateSetting('GMAIL_SEARCH_LABEL', settings.GMAIL_SEARCH_LABEL),
        config.updateSetting('GMAIL_PROCESSED_LABEL', settings.GMAIL_PROCESSED_LABEL),
        config.updateSetting('GEMINI_API_KEY', settings.GEMINI_API_KEY),
      ]);
      await onSaved();
    } catch (err: any) {
      alert("Error al guardar: " + safeText(err.message));
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
          <div className="bg-slate-900 border border-white/5 px-8 py-6 rounded-3xl font-mono text-xs text-emerald-500/80 break-all leading-relaxed">{String(dbId || 'No conectado')}</div>
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

        <button onClick={onLogout} className="w-full py-6 text-red-500/50 font-black uppercase text-[11px] tracking-widest border border-red-500/10 rounded-3xl hover:bg-red-500/5 transition-all">
          Cerrar Sesión y Desvincular
        </button>
      </div>
      <div className="text-center text-slate-800 text-[8px] font-black uppercase tracking-[1em]">Secure End-to-End Analytics</div>
    </div>
  );
};

export default App;
