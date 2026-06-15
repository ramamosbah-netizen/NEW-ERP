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
    const base = 'inline-flex items-center justify-center font-semibold rounded-lg border transition-all duration-100 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-[var(--bg-dark)] disabled:opacity-40 disabled:cursor-not-allowed select-none cursor-pointer shadow-sm';

    const variants: Record<ButtonVariant, string> = {
      primary:   'bg-[var(--primary)] text-[var(--bg-card)] border-transparent hover:bg-[var(--primary-hover)] focus:ring-[var(--primary)]',
      secondary: 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] hover:border-[var(--text-secondary)] focus:ring-[var(--border-focus)]',
      muted:     'bg-transparent border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] focus:ring-[var(--border-focus)]',
      danger:    'bg-[var(--status-danger-bg)] border-[var(--status-danger-border)] text-[var(--status-danger-text)] hover:bg-[var(--status-danger-border)] focus:ring-red-400',
      success:   'bg-[var(--status-success-bg)] border-[var(--status-success-border)] text-[var(--status-success-text)] hover:bg-[var(--status-success-border)] focus:ring-green-400',
      warning:   'bg-[var(--status-warning-bg)] border-[var(--status-warning-border)] text-[var(--status-warning-text)] hover:bg-[var(--status-warning-border)] focus:ring-amber-400',
    };

    const sizes: Record<ButtonSize, string> = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-9 px-4 text-xs gap-2',
      lg: 'h-10 px-5 text-sm gap-2',
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
