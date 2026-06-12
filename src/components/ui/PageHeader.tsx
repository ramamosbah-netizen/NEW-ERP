import React from 'react';
import { StatusChip, StatusType } from './StatusChip';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  referenceId?: string;
  status?: StatusType | string;
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  referenceId,
  status,
  actions,
  breadcrumbs,
  className = '',
}) => {
  return (
    <div className={`flex flex-col gap-2 mb-6 ${className}`}>
      {/* Optional Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="opacity-50 select-none">/</span>}
                {isLast || !crumb.href ? (
                  <span className={isLast ? 'text-[var(--primary)]' : ''}>{crumb.label}</span>
                ) : (
                  <a
                    href={crumb.href}
                    className="hover:text-[var(--text-primary)] transition-colors duration-100"
                  >
                    {crumb.label}
                  </a>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      {/* Main Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-condensed font-extrabold text-2xl md:text-3xl tracking-wide text-[var(--text-primary)] uppercase">
              {title}
            </h1>
            {referenceId && (
              <span className="font-mono text-sm font-semibold bg-[var(--bg-dark)] px-2 py-0.5 rounded text-[var(--text-secondary)] border border-[var(--border-color)]">
                {referenceId}
              </span>
            )}
            {status && <StatusChip status={status} />}
          </div>
          {subtitle && (
            <p className="text-[var(--text-secondary)] text-xs md:text-sm mt-1 leading-normal">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0 self-start md:self-center">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
