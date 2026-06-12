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

  // Dynamic, theme-aware trend styling
  const trendConfig = {
    up: {
      color: 'var(--success)',
      bg: 'var(--success-glow)',
      icon: ArrowUpRight,
    },
    down: {
      color: 'var(--error)',
      bg: 'var(--error-glow)',
      icon: ArrowDownRight,
    },
    neutral: {
      color: 'var(--text-secondary)',
      bg: 'rgba(148, 163, 184, 0.15)',
      icon: TrendingUp,
    },
  };

  const currentTrend = trendConfig[trend];
  const TrendIcon = currentTrend.icon;

  const sparkData = sparklineData?.map((val, idx) => ({ id: idx, value: val })) || [];

  return (
    <Card borderAccent={borderAccent} className={`flex flex-col justify-between overflow-hidden relative ${className}`}>
      <div className="flex justify-between items-start gap-4 mb-2">
        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider leading-none">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {tooltip && (
            <div className="group relative cursor-help">
              <HelpCircle size={14} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]" />
              <div className="absolute right-0 bottom-full mb-1.5 hidden group-hover:block w-48 p-2 bg-[var(--bg-card)] border border-[var(--border-color)] text-[10px] text-[var(--text-primary)] rounded shadow-xl z-50">
                {tooltip}
              </div>
            </div>
          )}
          {Icon && <Icon className="text-[var(--text-muted)]" size={18} />}
        </div>
      </div>

      <div className="flex items-baseline gap-1.5 mb-2.5">
        {valuePrefix && (
          <span className="text-sm font-bold text-[var(--text-muted)] font-mono">
            {valuePrefix}
          </span>
        )}
        <span className="text-2xl font-extrabold text-[var(--text-primary)] font-mono tracking-tight leading-none">
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
            <span className="text-[10px] text-[var(--text-muted)]">
              {changeText}
            </span>
          )}
        </div>

        {/* Responsive Mini Sparkline */}
        {sparkData.length > 0 && (
          <div className="h-7 w-20 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData}>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={borderAccent !== 'none' ? currentTrend.color : 'var(--primary)'}
                  strokeWidth={1.5}
                  fill={borderAccent !== 'none' ? currentTrend.color : 'var(--primary)'}
                  fillOpacity={0.08}
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
