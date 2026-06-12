import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}) => {
  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm z-[950] flex justify-end">
      {/* Backdrop closer click */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      {/* Drawer content board */}
      <div
        className={`w-full ${sizeClasses[size]} h-full bg-[var(--bg-card)] border-l border-[var(--border-color)] shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-250`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-5 py-4 gap-4">
          <h2 className="font-heading font-semibold text-[var(--text-primary)] text-base truncate">
            {title || 'Details'}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 rounded-lg hover:bg-[var(--bg-card-hover)] transition-all cursor-pointer"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrolling content */}
        <div className="flex-1 overflow-y-auto p-5 select-text custom-scrollbar text-[var(--text-primary)]">
          {children}
        </div>

        {/* Footer sticky bar */}
        {footer && (
          <div className="flex justify-end items-center gap-2 border-t border-[var(--border-color)] px-5 py-3 bg-[var(--bg-dark)]/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
