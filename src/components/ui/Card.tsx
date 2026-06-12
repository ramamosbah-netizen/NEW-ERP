import React from 'react';

interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; size?: number }>;
  headerActions?: React.ReactNode;
  hoverable?: boolean;
  borderAccent?: 'none' | 'primary' | 'secondary' | 'accent' | 'success' | 'danger' | 'warning';
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
      ...props
    },
    ref
  ) => {
    // Base styles: dynamic, flat and matte theme-aware
    const baseClass = 'bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg shadow-sm transition-all duration-150';
    
    const hoverClass = hoverable ? 'hover:border-[var(--text-muted)] hover:bg-[var(--bg-card-hover)]' : '';
    
    // Border accents
    const borderAccentClasses = {
      none: '',
      primary: 'border-l-4 border-l-[var(--primary)]',
      secondary: 'border-l-4 border-l-[var(--secondary)]',
      accent: 'border-l-4 border-l-[var(--accent)]',
      success: 'border-l-4 border-l-[var(--success)]',
      danger: 'border-l-4 border-l-[var(--error)]',
      warning: 'border-l-4 border-l-[var(--warning)]',
    };

    const hasHeader = title || subtitle || Icon || headerActions;

    return (
      <div
        ref={ref}
        className={`${baseClass} ${hoverClass} ${borderAccentClasses[borderAccent]} ${className}`}
        {...props}
      >
        {hasHeader && (
          <div className="flex justify-between items-start border-b border-[var(--border-color)] px-5 py-4 gap-4">
            <div className="flex items-start gap-3 min-w-0">
              {Icon && <Icon className="text-[var(--text-secondary)] mt-0.5 flex-shrink-0" size={18} />}
              <div className="min-w-0">
                {title && (
                  <h3 className="font-heading font-semibold text-[var(--text-primary)] text-base leading-5 truncate">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-[var(--text-secondary)] text-xs mt-0.5 truncate leading-4">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            {headerActions && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {headerActions}
              </div>
            )}
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    );
  }
);

Card.displayName = 'Card';
