import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'muted' | 'danger' | 'success' | 'warning';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: React.ComponentType<{ className?: string; size?: number }>;
  iconPosition?: 'left' | 'right';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = '',
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      icon: Icon,
      iconPosition = 'left',
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const base = 'inline-flex items-center justify-center font-medium rounded-md transition-all duration-100 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-[var(--bg-dark)] disabled:opacity-40 disabled:cursor-not-allowed select-none cursor-pointer';

    const variants: Record<ButtonVariant, string> = {
      primary:   'bg-[var(--primary)] text-[var(--bg-card)] hover:bg-[var(--primary-hover)] focus:ring-[var(--primary)]',
      secondary: 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] focus:ring-[var(--border-focus)]',
      muted:     'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] focus:ring-[var(--border-focus)]',
      danger:    'bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] hover:opacity-80 focus:ring-red-400',
      success:   'bg-[var(--status-success-bg)] border border-[var(--status-success-border)] text-[var(--status-success-text)] hover:opacity-80 focus:ring-green-400',
      warning:   'bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] text-[var(--status-warning-text)] hover:opacity-80 focus:ring-amber-400',
    };

    const sizes: Record<ButtonSize, string> = {
      sm: 'px-2.5 py-1.5 text-xs gap-1.5',
      md: 'px-3 py-2 text-sm gap-2',
      lg: 'px-4 py-2.5 text-sm gap-2',
    };

    const iconSize = size === 'lg' ? 15 : size === 'sm' ? 12 : 14;

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="animate-spin" size={iconSize} />}
        {!isLoading && Icon && iconPosition === 'left' && <Icon className="flex-shrink-0" size={iconSize} />}
        {children}
        {!isLoading && Icon && iconPosition === 'right' && <Icon className="flex-shrink-0" size={iconSize} />}
      </button>
    );
  }
);

Button.displayName = 'Button';
