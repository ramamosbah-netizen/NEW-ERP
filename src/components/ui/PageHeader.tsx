import React from 'react';
import Link from 'next/link';
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
    <div className={`flex flex-col gap-1.5 mb-5 ${className}`}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="opacity-40 select-none">›</span>}
                {isLast || !crumb.href ? (
                  <span className={isLast ? 'text-[var(--text-secondary)]' : ''}>{crumb.label}</span>
                ) : (
                  <Link href={crumb.href} className="hover:text-[var(--text-primary)] transition-colors duration-100">
                    {crumb.label}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-semibold text-lg text-[var(--text-primary)] tracking-tight leading-snug">
              {title}
            </h1>
            {referenceId && (
              <span className="font-mono text-xs font-medium bg-[var(--bg-dark)] px-2 py-0.5 rounded text-[var(--text-muted)] border border-[var(--border-color)]">
                {referenceId}
              </span>
            )}
            {status && <StatusChip status={status} />}
          </div>
          {subtitle && (
            <p className="text-[var(--text-muted)] text-sm mt-1 leading-normal">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-center">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
