import React, { useState, useMemo } from 'react';
import { Rule, Category } from '../types';
import { SheetsService } from '../services/SheetsService';
import { useApp } from '../contexts/AppContext';
import { safeText } from '../lib/utils';
import { DEFAULT_CATEGORY_NAMES } from '../lib/constants';

interface Props {
  rules: Rule[];
  categories: Category[];
}

export const RulesView: React.FC<Props> = ({ rules, categories }) => {
  const { token, dbId, toast, loadData } = useApp();

  const categoryOptions = useMemo(() => {
    const active = categories.filter(c => c.status === 'active');
    return active.length > 0
      ? active.map(c => c.name)
      : [...DEFAULT_CATEGORY_NAMES];
  }, [categories]);

  const defaultCategory = categoryOptions[0] ?? 'Otros';
  const [newRule, setNewRule] = useState<Rule>({ pattern: '', normalized: '', category: defaultCategory });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Rule>({ pattern: '', normalized: '', category: defaultCategory });

  const sheets = useMemo(() => new SheetsService(token), [token]);

  const handleAdd = async () => {
    if (!newRule.pattern || !newRule.normalized) return;
    try {
      await sheets.addRule(dbId, newRule);
      setNewRule({ pattern: '', normalized: '', category: defaultCategory });
      await loadData();
    } catch (err: unknown) {
      toast.error('Error al guardar regla: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDelete = async (rowIndex: number, pattern: string) => {
    if (!confirm(`¿Eliminar regla "${pattern}"?`)) return;
    try {
      await sheets.deleteRule(dbId, rowIndex);
      await loadData();
    } catch (err: unknown) {
      toast.error('Error al eliminar regla: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleSaveEdit = async () => {
    if (editingIndex === null) return;
    try {
      await sheets.updateRule(dbId, editingIndex + 2, editForm); // +2: header + 0-indexed
      setEditingIndex(null);
      await loadData();
    } catch (err: unknown) {
      toast.error('Error al actualizar regla: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const startEdit = (i: number) => {
    setEditingIndex(i);
    setEditForm({ ...rules[i] });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12">
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
              onChange={e => setNewRule(r => ({ ...r, pattern: safeText(e.target.value) }))}
              className="bg-slate-900 border border-white/5 rounded-2xl px-6 py-5 text-xs outline-none focus:border-emerald-500/50 focus:bg-slate-800 transition-all text-white placeholder:text-slate-700"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-black uppercase text-slate-600 tracking-widest ml-1">Nombre normalizado</label>
            <input
              placeholder="Agua con Gas"
              value={newRule.normalized}
              onChange={e => setNewRule(r => ({ ...r, normalized: safeText(e.target.value) }))}
              className="bg-slate-900 border border-white/5 rounded-2xl px-6 py-5 text-xs outline-none focus:border-emerald-500/50 focus:bg-slate-800 transition-all text-white placeholder:text-slate-700"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-black uppercase text-slate-600 tracking-widest ml-1">Categoría</label>
            <select
              value={newRule.category}
              onChange={e => setNewRule(r => ({ ...r, category: safeText(e.target.value) }))}
              className="bg-slate-900 border border-white/5 rounded-2xl px-6 py-5 text-xs outline-none text-slate-400 cursor-pointer appearance-none"
            >
              {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-black uppercase text-slate-600 tracking-widest ml-1 opacity-0">.</label>
            <button
              onClick={handleAdd}
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
                        <input value={editForm.pattern} onChange={e => setEditForm(f => ({ ...f, pattern: e.target.value }))} className="bg-slate-800 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-emerald-500/50 w-full" />
                      </td>
                      <td className="px-8 py-4">
                        <input value={editForm.normalized} onChange={e => setEditForm(f => ({ ...f, normalized: e.target.value }))} className="bg-slate-800 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-emerald-500/50 w-full" />
                      </td>
                      <td className="px-8 py-4">
                        <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} className="bg-slate-800 border border-white/10 rounded-xl px-4 py-2 text-xs text-slate-300 outline-none appearance-none cursor-pointer">
                          {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-8 py-4 text-right space-x-2">
                        <button onClick={handleSaveEdit} className="text-emerald-400 text-[10px] font-black uppercase tracking-widest hover:text-emerald-300 transition-colors">Guardar</button>
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
                        <button onClick={() => handleDelete(i + 2, r.pattern)} className="text-red-500/50 hover:text-red-400 text-[10px] font-black uppercase tracking-widest transition-colors">Borrar</button>
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
