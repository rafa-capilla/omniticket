import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { COLORS } from '../../../lib/utils';

interface Props {
  data: { name: string; value: number }[];
  title: string;
  innerRadius?: number;
  outerRadius?: number;
}

const TOOLTIP_STYLE = {
  backgroundColor: '#020617',
  border: 'none',
  borderRadius: '16px',
  fontSize: '10px',
  fontWeight: 'bold',
} as const;

export const PieChartCard: React.FC<Props> = ({
  data,
  title,
  innerRadius = 100,
  outerRadius = 140,
}) => (
  <div className="bg-white/[0.02] p-8 rounded-[3rem] border border-white/5 h-[500px] flex flex-col shadow-2xl relative overflow-hidden">
    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[80px] -mr-32 -mt-32"></div>
    <h3 className="text-[11px] font-black mb-8 uppercase tracking-widest text-slate-500 flex items-center">
      <div className="w-2 h-2 rounded-full bg-emerald-500 mr-3 animate-pulse"></div>
      {title}
    </h3>
    <div className="flex-1 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={8}
            dataKey="value"
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            itemStyle={{ color: '#fff' }}
            cursor={{ fill: 'transparent' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  </div>
);
