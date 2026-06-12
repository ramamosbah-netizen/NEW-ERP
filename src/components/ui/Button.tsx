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
    // Base styles: snappy active scaling and matte outline offset
    const baseClass = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-100 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bg-dark)] disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer';

    const variantClasses: Record<ButtonVariant, string> = {
      primary: 'bg-primary text-white hover:bg-primary-hover focus:ring-primary',
      secondary: 'bg-bg-dark border border-border-color text-text-primary hover:bg-bg-card-hover focus:ring-primary',
      muted: 'bg-transparent text-[var(--text-secondary)] hover:bg-bg-card-hover hover:text-[var(--text-primary)] focus:ring-primary',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
      success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500',
      warning: 'bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500',
    };

    // Size classes (supporting compact density styles)
    const sizeClasses: Record<ButtonSize, string> = {
      sm: 'px-2.5 py-1.5 text-xs gap-1.5',
      md: 'px-3.5 py-2 text-sm gap-2',
      lg: 'px-5 py-2.5 text-base gap-2.5',
    };

    const isBtnDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isBtnDisabled}
        className={`${baseClass} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="animate-spin" size={size === 'sm' ? 12 : 16} />}
        {!isLoading && Icon && iconPosition === 'left' && <Icon className="flex-shrink-0" size={size === 'sm' ? 14 : 16} />}
        {children}
        {!isLoading && Icon && iconPosition === 'right' && <Icon className="flex-shrink-0" size={size === 'sm' ? 14 : 16} />}
      </button>
    );
  }
);

Button.displayName = 'Button';
