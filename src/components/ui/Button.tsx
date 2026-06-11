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
    // Base styles
    const baseClass = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#060814] disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer';

    // Variant classes matching the Bloomberg Obsidian theme
    const variantClasses: Record<ButtonVariant, string> = {
      primary: 'bg-[#00E5A0] text-[#060814] hover:bg-[#00c489] hover:shadow-[0_0_16px_rgba(0,229,160,0.3)] focus:ring-[#00E5A0]',
      secondary: 'bg-white/4 border border-white/8 text-white hover:bg-white/9 hover:border-white/16 focus:ring-white/20',
      muted: 'bg-white/2 border border-transparent text-slate-400 hover:bg-white/6 hover:text-white focus:ring-white/10',
      danger: 'bg-red-500/12 border border-red-500/35 text-red-300 hover:bg-red-500/22 hover:border-red-500/60 hover:shadow-[0_0_14px_rgba(239,68,68,0.15)] focus:ring-red-500',
      success: 'bg-emerald-500/12 border border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/22 hover:border-emerald-500/60 hover:shadow-[0_0_14px_rgba(16,185,129,0.15)] focus:ring-emerald-500',
      warning: 'bg-amber-500/12 border border-amber-500/35 text-amber-300 hover:bg-amber-500/22 hover:border-amber-500/60 hover:shadow-[0_0_14px_rgba(245,158,11,0.15)] focus:ring-amber-500',
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
