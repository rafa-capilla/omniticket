import React from 'react';
import type { DashboardStats } from '@/shared/types/domain';

interface Props {
  stats: DashboardStats;
}

const KPI_CONFIG = [
  { key: 'totalSpent', label: 'Gasto Total', icon: '💰', format: (v: number) => `${v.toFixed(2)}€` },
  { key: 'avgTicket', label: 'Ticket Promedio', icon: '🧾', format: (v: number) => `${v.toFixed(2)}€` },
  { key: 'topCategory', label: 'Top Categoría', icon: '🏷️', format: (v: string) => v },
  { key: 'ticketCount', label: 'Tickets Procesados', icon: '📦', format: (v: number) => String(v) },
] as const;

export const KpiDashboard: React.FC<Props> = ({ stats }) => (
  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
    {KPI_CONFIG.map((kpi) => {
      const raw = stats[kpi.key as keyof DashboardStats];
      const value = typeof raw === 'string'
        ? (kpi.format as (v: string) => string)(raw)
        : (kpi.format as (v: number) => string)(raw as number);

      return (
        <div
          key={kpi.key}
          className="bg-white/[0.03] border border-white/5 p-6 rounded-[2rem] flex flex-col justify-between"
        >
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center">
            <span className="mr-2 opacity-60">{kpi.icon}</span>
            {kpi.label}
          </div>
          <div className="text-3xl font-black text-white tracking-tighter">{value}</div>
        </div>
      );
    })}
  </div>
);
