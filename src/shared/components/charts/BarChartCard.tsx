import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  data: { name: string; value: number }[];
  title: string;
  maxItems?: number;
  barColor?: string;
  barSize?: number;
}

const TOOLTIP_STYLE = {
  backgroundColor: '#020617',
  border: 'none',
  borderRadius: '16px',
  fontSize: '10px',
} as const;

export const BarChartCard: React.FC<Props> = ({
  data,
  title,
  maxItems = 10,
  barColor = '#10b981',
  barSize = 24,
}) => (
  <div className="bg-white/[0.02] p-8 rounded-[3rem] border border-white/5 h-[500px] flex flex-col shadow-2xl relative overflow-hidden">
    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[80px] -mr-32 -mt-32"></div>
    <h3 className="text-[11px] font-black mb-8 uppercase tracking-widest text-slate-500 flex items-center">
      <div className="w-2 h-2 rounded-full bg-emerald-500 mr-3 animate-pulse"></div>
      {title}
    </h3>
    <div className="flex-1 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.slice(0, maxItems)} layout="vertical">
          <XAxis type="number" hide />
          <YAxis
            dataKey="name"
            type="category"
            width={120}
            tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          />
          <Bar
            dataKey="value"
            fill={barColor}
            radius={[0, 12, 12, 0]}
            barSize={barSize}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);
