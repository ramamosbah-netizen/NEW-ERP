import React from 'react';

interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; size?: number }>;
  headerActions?: React.ReactNode;
  hoverable?: boolean;
  borderAccent?: 'none' | 'primary' | 'secondary' | 'accent' | 'success' | 'danger' | 'warning';
  padding?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      className = '',
      title,
      subtitle,
      icon: Icon,
      headerActions,
      hoverable = false,
      borderAccent = 'none',
      padding = true,
      ...props
    },
    ref
  ) => {
    const base = 'bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg transition-colors duration-100';
    const hover = hoverable ? 'hover:border-[var(--text-muted)]' : '';

    const accents: Record<NonNullable<CardProps['borderAccent']>, string> = {
      none:      '',
      primary:   'border-l-2 border-l-[var(--text-primary)]',
      secondary: 'border-l-2 border-l-[var(--text-muted)]',
      accent:    'border-l-2 border-l-[var(--accent)]',
      success:   'border-l-2 border-l-[var(--success)]',
      danger:    'border-l-2 border-l-[var(--error)]',
      warning:   'border-l-2 border-l-[var(--warning)]',
    };

    const hasHeader = title || subtitle || Icon || headerActions;

    return (
      <div
        ref={ref}
        className={`${base} ${hover} ${accents[borderAccent]} ${className}`}
        {...props}
      >
        {hasHeader && (
          <div className="flex justify-between items-start border-b border-[var(--border-color)] px-4 py-3 gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              {Icon && <Icon className="text-[var(--text-muted)] mt-0.5 flex-shrink-0" size={16} />}
              <div className="min-w-0">
                {title && (
                  <h3 className="font-semibold text-[var(--text-primary)] text-sm leading-5 truncate">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-[var(--text-muted)] text-xs mt-0.5 leading-4">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            {headerActions && (
              <div className="flex items-center gap-2 flex-shrink-0">{headerActions}</div>
            )}
          </div>
        )}
        <div className={padding ? 'p-4' : ''}>{children}</div>
      </div>
    );
  }
);

Card.displayName = 'Card';
