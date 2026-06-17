// ============================================================
// JEET ERP — Design System: in-page Tabs
// Standard horizontal tab strip for switching sections within a page
// (visually consistent with the hub header tabs). Controlled.
// ============================================================

import React from 'react';

export interface TabItem {
  key: string;
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  count?: number | string;
  disabled?: boolean;
}

interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
  /** 'underline' (default) or 'pill' */
  variant?: 'underline' | 'pill';
}

export const Tabs: React.FC<TabsProps> = ({ tabs, value, onChange, className = '', variant = 'underline' }) => {
  return (
    <div
      role="tablist"
      className={
        `flex items-stretch gap-1 overflow-x-auto ` +
        (variant === 'underline' ? 'border-b border-[var(--border-color)] ' : '') +
        className
      }
    >
      {tabs.map(tab => {
        const active = tab.key === value;
        const Icon = tab.icon;
        const base = 'inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium transition-colors duration-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
        const styles = variant === 'pill'
          ? `px-3 py-1.5 rounded-[var(--radius-md)] ${active
              ? 'bg-[var(--primary)] text-[var(--bg-card)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'}`
          : `px-3.5 py-2.5 border-b-2 -mb-px ${active
              ? 'border-[var(--accent)] text-[var(--text-primary)] font-semibold'
              : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active}
            disabled={tab.disabled}
            onClick={() => onChange(tab.key)}
            className={`${base} ${styles}`}
          >
            {Icon && <Icon size={14} className="flex-shrink-0" />}
            {tab.label}
            {tab.count !== undefined && (
              <span className={`ml-0.5 rounded-[var(--radius-full)] px-1.5 py-0.5 text-[10px] font-semibold ${
                active && variant === 'pill'
                  ? 'bg-[var(--bg-card)]/20 text-[var(--bg-card)]'
                  : 'bg-[var(--status-neutral-bg)] text-[var(--text-muted)]'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
