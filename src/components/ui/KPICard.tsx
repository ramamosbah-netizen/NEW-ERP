import React from 'react';
import { Card } from './Card';
import { ArrowUpRight, ArrowDownRight, TrendingUp, HelpCircle } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  changeText?: string;
  trend?: 'up' | 'down' | 'neutral';
  tooltip?: string;
  sparklineData?: number[];
  borderAccent?: 'none' | 'primary' | 'secondary' | 'accent' | 'success' | 'danger' | 'warning';
  icon?: React.ComponentType<{ className?: string; size?: number }>;
  className?: string;
  valuePrefix?: string;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  change,
  changeText,
  trend = 'neutral',
  tooltip,
  sparklineData,
  borderAccent = 'none',
  icon: Icon,
  className = '',
  valuePrefix = '',
}) => {
  const isNumeric = typeof value === 'number';
  
  // Format numeric values standard (AED or plain)
  const displayValue = isNumeric
    ? new Intl.NumberFormat('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value as number)
    : value;

  // Change colors
  const trendConfig = {
    up: {
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.12)',
      icon: ArrowUpRight,
    },
    down: {
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.12)',
      icon: ArrowDownRight,
    },
    neutral: {
      color: '#94a3b8',
      bg: 'rgba(148, 163, 184, 0.12)',
      icon: TrendingUp,
    },
  };

  const currentTrend = trendConfig[trend];
  const TrendIcon = currentTrend.icon;

  const sparkData = sparklineData?.map((val, idx) => ({ id: idx, value: val })) || [];

  return (
    <Card borderAccent={borderAccent} className={`flex flex-col justify-between overflow-hidden relative ${className}`}>
      <div className="flex justify-between items-start gap-4 mb-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider leading-none">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {tooltip && (
            <div className="group relative cursor-help">
              <HelpCircle size={14} className="text-slate-500 hover:text-slate-300" />
              <div className="absolute right-0 bottom-full mb-1.5 hidden group-hover:block w-48 p-2 bg-[#090e24] border border-white/10 text-[10px] text-slate-300 rounded shadow-xl z-50">
                {tooltip}
              </div>
            </div>
          )}
          {Icon && <Icon className="text-slate-500" size={18} />}
        </div>
      </div>

      <div className="flex items-baseline gap-1.5 mb-2.5">
        {valuePrefix && (
          <span className="text-sm font-bold text-slate-500 font-mono">
            {valuePrefix}
          </span>
        )}
        <span className="text-2xl font-extrabold text-white font-mono tracking-tight leading-none">
          {displayValue}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 mt-auto">
        <div className="flex items-center gap-1.5">
          {change !== undefined && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold"
              style={{ color: currentTrend.color, backgroundColor: currentTrend.bg }}
            >
              <TrendIcon size={12} className="mr-0.5" />
              {change > 0 ? `+${change}%` : `${change}%`}
            </span>
          )}
          {changeText && (
            <span className="text-[10px] text-slate-500">
              {changeText}
            </span>
          )}
        </div>

        {/* Responsive Mini Sparkline */}
        {sparkData.length > 0 && (
          <div className="h-7 w-20 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData}>
                <defs>
                  <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={borderAccent !== 'none' ? currentTrend.color : '#00E5A0'} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={borderAccent !== 'none' ? currentTrend.color : '#00E5A0'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={borderAccent !== 'none' ? currentTrend.color : '#00E5A0'}
                  strokeWidth={1.5}
                  fill={`url(#grad-${title})`}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
};
