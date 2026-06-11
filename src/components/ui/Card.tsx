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
    // Base styles: Obsidian layered card layout
    const baseClass = 'bg-[#0d1127]/55 border border-white/8 rounded-xl shadow-lg shadow-black/30 transition-all duration-300';
    
    const hoverClass = hoverable ? 'hover:border-white/14 hover:bg-[#141a38]/75 hover:shadow-xl hover:shadow-black/45' : '';
    
    // Border accents
    const borderAccentClasses = {
      none: '',
      primary: 'border-l-4 border-l-[#00E5A0]',
      secondary: 'border-l-4 border-l-[#22d3ee]',
      accent: 'border-l-4 border-l-[#a855f7]',
      success: 'border-l-4 border-l-[#10b981]',
      danger: 'border-l-4 border-l-[#ef4444]',
      warning: 'border-l-4 border-l-[#f59e0b]',
    };

    const hasHeader = title || subtitle || Icon || headerActions;

    return (
      <div
        ref={ref}
        className={`${baseClass} ${hoverClass} ${borderAccentClasses[borderAccent]} ${className}`}
        {...props}
      >
        {hasHeader && (
          <div className="flex justify-between items-start border-b border-white/6 px-5 py-4 gap-4">
            <div className="flex items-start gap-3 min-w-0">
              {Icon && <Icon className="text-slate-400 mt-0.5 flex-shrink-0" size={18} />}
              <div className="min-w-0">
                {title && (
                  <h3 className="font-heading font-semibold text-white text-base leading-5 truncate">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-slate-400 text-xs mt-0.5 truncate leading-4">
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
