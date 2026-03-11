import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Rule, Category, DashboardStats, LensType } from '../types';
import { AIAnalysisView } from './AIAnalysisView';
import { safeText, safeNum, COLORS } from '../lib/utils';
import { TOTAL_TICKET_MARKER } from '../lib/constants';

interface Props {
  currentLens: LensType;
  setCurrentLens: (lens: LensType) => void;
  rawLines: string[][];
  dateRange: { start: string; end: string };
  setDateRange: React.Dispatch<React.SetStateAction<{ start: string; end: string }>>;
  rules: Rule[];
  categories: Category[];
}

const LENS_LABELS: Record<LensType, string> = {
  products: 'Productos',
  categories: 'Categorías',
  stores: 'Tiendas',
  analysis: 'Análisis',
};

export const LensesView: React.FC<Props> = ({
  currentLens, setCurrentLens, rawLines, dateRange, setDateRange, rules, categories,
}) => {
  const activeCategories = useMemo(() => categories.filter(c => c.status === 'active'), [categories]);

  const processedData = useMemo(() => {
    return rawLines
      .filter((row: string[]) => {
        const date = row[2] ?? '';
        return date >= dateRange.start && date <= dateRange.end;
      })
      .map((row: string[]) => {
        const originalName = safeText(row[3] ?? '');
        if (originalName === TOTAL_TICKET_MARKER || !originalName) return row;

        const matchedRule = rules.find(r =>
          r.pattern && originalName.toLowerCase().includes(safeText(r.pattern).toLowerCase())
        );
        const normalizedFromSync = safeText(row[9] ?? '');
        let normalizedName = normalizedFromSync || originalName;
        let category = safeText(row[4] ?? 'Otros');

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

    processedData.forEach((row: string[]) => {
      if (row[3] === TOTAL_TICKET_MARKER) {
        total += safeNum(row[8]);
        count++;
      } else {
        const cat = safeText(row[4]);
        catMap.set(cat, (catMap.get(cat) ?? 0) + safeNum(row[8]));
      }
    });

    let topCat = 'Ninguna';
    let maxVal = -1;
    catMap.forEach((v, k) => { if (v > maxVal) { maxVal = v; topCat = k; } });

    return { totalSpent: total, avgTicket: count > 0 ? total / count : 0, topCategory: topCat, ticketCount: count };
  }, [processedData]);

  const lensData = useMemo(() => {
    if (currentLens === 'categories') {
      const agg = new Map<string, number>(activeCategories.map(c => [c.name, 0]));
      processedData.forEach((row: string[]) => {
        if (row[3] === TOTAL_TICKET_MARKER || !row[3]) return;
        const key = safeText(row[4]);
        agg.set(key, (agg.get(key) ?? 0) + safeNum(row[8]));
      });
      return Array.from(agg.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }

    const agg = new Map<string, number>();
    processedData.forEach((row: string[]) => {
      let key = '';
      if (currentLens === 'products') key = safeText(row[3]);
      else if (currentLens === 'stores') key = safeText(row[1]);
      if (safeText(row[3]) === TOTAL_TICKET_MARKER || !key) return;
      agg.set(key, (agg.get(key) ?? 0) + safeNum(row[8]));
    });
    return Array.from(agg.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [processedData, currentLens, activeCategories]);

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Gasto Total',        value: `${stats.totalSpent.toFixed(2)}€`, icon: '💰' },
          { label: 'Ticket Promedio',    value: `${stats.avgTicket.toFixed(2)}€`,  icon: '🧾' },
          { label: 'Top Categoría',      value: stats.topCategory,                 icon: '🏷️' },
          { label: 'Tickets Procesados', value: stats.ticketCount,                 icon: '📦' },
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
              {LENS_LABELS[lens]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {[
            {
              label: '30d', fn: () => {
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - 30);
                return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
              }
            },
            {
              label: '3m', fn: () => {
                const end = new Date();
                const start = new Date();
                start.setMonth(end.getMonth() - 3);
                return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
              }
            },
            {
              label: 'año', fn: () => {
                const now = new Date();
                const start = new Date(now.getFullYear(), 0, 1);
                const end = new Date(now.getFullYear(), 11, 31);
                return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
              }
            },
          ].map(({ label, fn }) => (
            <button
              key={label}
              onClick={() => setDateRange(fn())}
              className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
            >
              {label}
            </button>
          ))}
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
      </div>

      {currentLens === 'analysis' && (
        <AIAnalysisView rawLines={rawLines} dateRange={dateRange} categories={activeCategories} />
      )}

      {currentLens !== 'analysis' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white/[0.02] p-8 rounded-[3rem] border border-white/5 h-[500px] flex flex-col shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[80px] -mr-32 -mt-32"></div>
            <h3 className="text-[11px] font-black mb-8 uppercase tracking-widest text-slate-500 flex items-center">
              <div className="w-2 h-2 rounded-full bg-emerald-500 mr-3 animate-pulse"></div>
              Distribución por {LENS_LABELS[currentLens]}
            </h3>
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {currentLens === 'categories' ? (
                  <PieChart>
                    <Pie data={lensData} cx="50%" cy="50%" innerRadius={100} outerRadius={140} paddingAngle={8} dataKey="value" stroke="none">
                      {lensData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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
                <div className="flex flex-col items-center justify-center text-slate-600 opacity-50 py-20">
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
