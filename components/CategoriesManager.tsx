import React, { useState, useMemo } from 'react';
import { Category } from '../types';
import { useApp } from '../contexts/AppContext';
import { safeText, getErrorMessage } from '../lib/utils';
import { useServiceFactory } from '../presentation/hooks/useServiceFactory';

interface Props {
  categories: Category[];
  categoryCounts: Map<string, number>;
}

const CATEGORY_COLORS: Record<number, string> = {
  0: 'bg-emerald-500/20 text-emerald-400',
  1: 'bg-blue-500/20 text-blue-400',
  2: 'bg-amber-500/20 text-amber-400',
  3: 'bg-red-500/20 text-red-400',
  4: 'bg-purple-500/20 text-purple-400',
  5: 'bg-pink-500/20 text-pink-400',
  6: 'bg-indigo-500/20 text-indigo-400',
};

export const CategoriesManager: React.FC<Props> = ({ categories, categoryCounts }) => {
  const { token, dbId, toast, loadData } = useApp();

  const [newCat, setNewCat] = useState({ name: '', description: '' });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [deleteModal, setDeleteModal] = useState<{ index: number; name: string; replacement: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const activeCategories = useMemo(() => categories.filter(c => c.status === 'active'), [categories]);
  const { sheets, manageCategories } = useServiceFactory(token);

  const handleAdd = async () => {
    if (!newCat.name.trim()) return;
    setIsLoading(true);
    try {
      await sheets.addCategory(dbId, { name: newCat.name.trim(), description: newCat.description.trim(), status: 'active' });
      setNewCat({ name: '', description: '' });
      await loadData();
    } catch (err: unknown) {
      toast.error('Error al añadir: ' + getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (editingIndex === null) return;
    setIsLoading(true);
    try {
      const original = categories[editingIndex];
      if (!original) return;
      const updated: Category = { ...original, name: editForm.name.trim(), description: editForm.description.trim() };
      await sheets.updateCategory(dbId, editingIndex + 2, updated); // +2: header + 0-indexed
      setEditingIndex(null);
      await loadData();
    } catch (err: unknown) {
      toast.error('Error al editar: ' + getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const initiateDelete = (index: number, name: string) => {
    const count = categoryCounts.get(name) ?? 0;
    const others = activeCategories.filter(c => c.name !== name);
    const defaultReplacement = others.find(c => c.name === 'Otros')?.name ?? others[0]?.name ?? 'Otros';

    if (count === 0) {
      if (!confirm(`¿Eliminar la categoría "${name}"? No tiene productos asociados.`)) return;
      executeDelete(index, name, '');
    } else {
      setDeleteModal({ index, name, replacement: defaultReplacement });
    }
  };

  const executeDelete = async (index: number, name: string, replacement: string) => {
    setIsLoading(true);
    try {
      await manageCategories.deleteWithCascade(dbId, index + 2, name, replacement);
      setDeleteModal(null);
      await loadData();
    } catch (err: unknown) {
      toast.error('Error al eliminar: ' + getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
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
              onChange={e => setNewCat(c => ({ ...c, name: e.target.value }))}
              className="bg-slate-900 border border-white/5 rounded-2xl px-6 py-5 text-xs outline-none focus:border-emerald-500/50 focus:bg-slate-800 transition-all text-white placeholder:text-slate-700"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-black uppercase text-slate-600 tracking-widest ml-1">Descripción</label>
            <input
              placeholder="Pan, bollería, pasteles..."
              value={newCat.description}
              onChange={e => setNewCat(c => ({ ...c, description: e.target.value }))}
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
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-emerald-500/50" />
                <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-emerald-500/50" />
              </div>
            ) : (
              <div className="flex items-center space-x-5 flex-1">
                <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${CATEGORY_COLORS[i % 7]}`}>{cat.name}</span>
                <span className="text-slate-600 text-xs truncate max-w-xs">{cat.description}</span>
                {(categoryCounts.get(cat.name) ?? 0) > 0 && (
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
                  <button onClick={() => { setEditingIndex(i); setEditForm({ name: cat.name, description: cat.description }); }} className="text-slate-600 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors px-2">Editar</button>
                  {cat.name !== 'Otros' && (
                    <button onClick={() => initiateDelete(i, cat.name)} className="text-red-500/40 hover:text-red-400 text-[10px] font-black uppercase tracking-widest transition-colors px-2">Borrar</button>
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
              <span className="text-amber-400 font-bold">{categoryCounts.get(deleteModal.name) ?? 0} productos</span> asociados. Elige una categoría de reemplazo:
            </p>
            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black uppercase text-slate-600 tracking-widest ml-1">Reasignar a</label>
              <select
                value={deleteModal.replacement}
                onChange={e => setDeleteModal(m => m ? { ...m, replacement: e.target.value } : m)}
                className="bg-slate-800 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white outline-none appearance-none cursor-pointer"
              >
                {activeCategories.filter(c => c.name !== deleteModal.name).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex space-x-4">
              <button onClick={() => executeDelete(deleteModal.index, deleteModal.name, deleteModal.replacement)} disabled={isLoading} className="flex-1 bg-red-500 text-white font-black py-4 rounded-2xl text-[11px] uppercase tracking-widest hover:bg-red-400 disabled:opacity-50 transition-all">
                {isLoading ? 'Procesando...' : 'Confirmar y Borrar'}
              </button>
              <button onClick={() => setDeleteModal(null)} className="flex-1 bg-white/5 text-slate-400 font-black py-4 rounded-2xl text-[11px] uppercase tracking-widest hover:bg-white/10 transition-all">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
