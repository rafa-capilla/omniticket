import React from 'react';
import type { DashboardStats } from '@/shared/types/domain';

interface Props {
  stats: DashboardStats;
}

interface KpiEntry {
  key: string;
  label: string;
  icon: string;
  getValue: (stats: DashboardStats) => string;
}

const KPI_CONFIG: KpiEntry[] = [
  { key: 'totalSpent', label: 'Gasto Total', icon: '💰', getValue: s => `${s.totalSpent.toFixed(2)}€` },
  { key: 'avgTicket', label: 'Ticket Promedio', icon: '🧾', getValue: s => `${s.avgTicket.toFixed(2)}€` },
  { key: 'topCategory', label: 'Top Categoría', icon: '🏷️', getValue: s => s.topCategory },
  { key: 'ticketCount', label: 'Tickets Procesados', icon: '📦', getValue: s => String(s.ticketCount) },
];

export const KpiDashboard: React.FC<Props> = ({ stats }) => (
  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
    {KPI_CONFIG.map((kpi) => (
      <div
        key={kpi.key}
        className="bg-white/[0.03] border border-white/5 p-6 rounded-[2rem] flex flex-col justify-between"
      >
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center">
          <span className="mr-2 opacity-60">{kpi.icon}</span>
          {kpi.label}
        </div>
        <div className="text-3xl font-black text-white tracking-tighter">{kpi.getValue(stats)}</div>
      </div>
    ))}
  </div>
);
