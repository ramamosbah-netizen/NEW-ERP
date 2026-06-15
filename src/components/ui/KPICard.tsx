import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, HelpCircle } from 'lucide-react';

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
  icon: Icon,
  className = '',
  valuePrefix = '',
}) => {
  const isNumeric = typeof value === 'number';
  const displayValue = isNumeric
    ? new Intl.NumberFormat('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value as number)
    : value;

  const trendIcon = {
    up:      <ArrowUpRight size={12} className="text-[var(--success)]" />,
    down:    <ArrowDownRight size={12} className="text-[var(--error)]" />,
    neutral: <Minus size={12} className="text-[var(--text-muted)]" />,
  }[trend];

  const trendColor = {
    up:      'text-[var(--success)]',
    down:    'text-[var(--error)]',
    neutral: 'text-[var(--text-muted)]',
  }[trend];

  const sparkMax = sparklineData ? Math.max(...sparklineData) : 0;
  const sparkMin = sparklineData ? Math.min(...sparklineData) : 0;
  const sparkRange = sparkMax - sparkMin || 1;

  return (
    <div className={`bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 flex flex-col gap-3 min-h-[120px] ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)] leading-none">
          {title}
        </span>
        <div className="flex items-center gap-1.5">
          {tooltip && (
            <div className="group relative cursor-help">
              <HelpCircle size={13} className="text-[var(--text-muted)] opacity-60 hover:opacity-100" />
              <div className="absolute right-0 bottom-full mb-1.5 hidden group-hover:block w-52 p-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)] rounded-lg shadow-lg z-50 leading-relaxed">
                {tooltip}
              </div>
            </div>
          )}
          {Icon && <Icon className="text-[var(--text-muted)] opacity-50" size={15} />}
        </div>
      </div>

      <div className="flex items-baseline gap-1">
        {valuePrefix && (
          <span className="text-xs text-[var(--text-muted)] font-mono">{valuePrefix}</span>
        )}
        <span className="text-xl font-semibold text-[var(--text-primary)] tracking-tight leading-none">
          {displayValue}
        </span>
      </div>

      <div className="flex items-end justify-between gap-3 mt-auto">
        <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
          {trendIcon}
          {change !== undefined && (
            <span>{change > 0 ? `+${change}` : change}%</span>
          )}
          {changeText && (
            <span className="text-[var(--text-muted)]">{changeText}</span>
          )}
        </div>

        {sparklineData && sparklineData.length > 1 && (
          <svg width="64" height="24" viewBox={`0 0 64 24`} className="flex-shrink-0 opacity-60">
            <polyline
              points={sparklineData.map((v, i) => {
                const x = (i / (sparklineData.length - 1)) * 60 + 2;
                const y = 22 - ((v - sparkMin) / sparkRange) * 18;
                return `${x},${y}`;
              }).join(' ')}
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
    </div>
  );
};
