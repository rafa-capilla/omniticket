import React from 'react';
import type { Rule, Category, LensType } from '@/shared/types/domain';
import { AIAnalysisView } from '@/components/AIAnalysisView';
import { safeText, toLocalDateString } from '@/lib/utils';
import { useDataAggregation } from '@/presentation/hooks/useDataAggregation';
import { KpiDashboard } from '@/presentation/components/KpiDashboard';
import { PieChartCard } from '@/presentation/components/charts/PieChartCard';
import { BarChartCard } from '@/presentation/components/charts/BarChartCard';

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
  const { stats, lensData } = useDataAggregation(rawLines, dateRange, rules, categories, currentLens);
  const activeCategories = categories.filter(c => c.status === 'active');

  return (
    <div className="space-y-8">
      <KpiDashboard stats={stats} />

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
                return { start: toLocalDateString(start), end: toLocalDateString(end) };
              }
            },
            {
              label: '3m', fn: () => {
                const end = new Date();
                const start = new Date();
                start.setMonth(end.getMonth() - 3);
                return { start: toLocalDateString(start), end: toLocalDateString(end) };
              }
            },
            {
              label: 'año', fn: () => {
                const now = new Date();
                const start = new Date(now.getFullYear(), 0, 1);
                const end = new Date(now.getFullYear(), 11, 31);
                return { start: toLocalDateString(start), end: toLocalDateString(end) };
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
          {currentLens === 'categories' ? (
            <PieChartCard
              data={lensData}
              title={`Distribución por ${LENS_LABELS[currentLens]}`}
            />
          ) : (
            <BarChartCard
              data={lensData}
              title={`Distribución por ${LENS_LABELS[currentLens]}`}
            />
          )}

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
