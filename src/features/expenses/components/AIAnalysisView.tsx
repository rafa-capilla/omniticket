import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import type { Category, AIAnalysisResult, DateRange } from '@/shared/types/domain';
import { AIAnalysisService } from '@/services/AIAnalysisService';
import { useApp } from '@/contexts/AppContext';
import { COLORS, getErrorMessage } from '@/lib/utils';
import { buildAggregatedData } from '@/domain/services/DataAggregator';
import { useServiceFactory } from '@/shared/hooks/useServiceFactory';

interface Props {
  rawLines: string[][];
  dateRange: DateRange;
  categories: Category[];
}

const EXAMPLE_PROMPTS = [
  "Divide mis gastos en esenciales vs no esenciales",
  "¿Qué productos podría eliminar para ahorrar?",
  "¿En qué tiendas gasto más y por qué?",
];

const TOOLTIP_STYLE = {
  backgroundColor: '#020617',
  border: 'none',
  borderRadius: '16px',
  fontSize: '10px',
} as const;

export const AIAnalysisView: React.FC<Props> = ({ rawLines, dateRange, categories }) => {
  const { token, dbId, toast } = useApp();
  const { config } = useServiceFactory(token);
  const [prompt, setPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AIAnalysisResult | null>(null);

  const aggregatedData = useMemo(
    () => buildAggregatedData(rawLines, dateRange, categories),
    [rawLines, dateRange, categories],
  );

  const handleAnalyze = async () => {
    if (!prompt.trim()) return;
    setIsAnalyzing(true);
    try {
      const settings = await config.getSettings(dbId);
      if (!settings.GEMINI_API_KEY) {
        toast.error('Configura tu GEMINI_API_KEY en la vista Settings primero.');
        return;
      }
      const svc = new AIAnalysisService();
      const res = await svc.analyze(prompt, aggregatedData, settings.GEMINI_API_KEY);
      setResult(res);
    } catch (err: unknown) {
      toast.error('Error en análisis: ' + getErrorMessage(err));
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[3rem]">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-emerald-400 mb-2 flex items-center">
          <span className="mr-3">✨</span> Análisis a la Carta con Gemini
        </h3>
        <p className="text-slate-600 text-xs mb-6">Haz cualquier pregunta sobre tus gastos del período seleccionado.</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {EXAMPLE_PROMPTS.map((ex, i) => (
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
                    <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: '#fff' }} />
                  </PieChart>
                ) : (
                  <BarChart data={result.chart_data.slice(0, 10)} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={130} tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
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
