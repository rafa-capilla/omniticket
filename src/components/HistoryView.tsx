import React from 'react';
import type { HistoryTicket } from '@/shared/types/domain';

interface Props {
  history: HistoryTicket[];
}

export const HistoryView: React.FC<Props> = ({ history }) => (
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
          <tr>
            <th className="px-10 py-7">Fecha de Compra</th>
            <th className="px-10 py-7">Establecimiento</th>
            <th className="px-10 py-7 text-right">Monto Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {history.map(t => (
            <tr key={String(t.id)} className="group hover:bg-emerald-500/[0.03] transition-colors cursor-pointer">
              <td className="px-10 py-7 font-mono text-xs text-slate-500 group-hover:text-emerald-500/50 transition-colors">
                {String(t.fecha)}
              </td>
              <td className="px-10 py-7 font-black text-sm text-slate-200">{String(t.tienda)}</td>
              <td className="px-10 py-7 text-right font-black text-white text-2xl tracking-tighter">
                {Number(t.total).toFixed(2)}<span className="text-emerald-500 ml-1">€</span>
              </td>
            </tr>
          ))}
          {history.length === 0 && (
            <tr>
              <td colSpan={3} className="px-10 py-20 text-center text-slate-700">
                <div className="text-4xl mb-4">🧾</div>
                <p className="text-[10px] font-black uppercase tracking-widest">Sin tickets procesados</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);
