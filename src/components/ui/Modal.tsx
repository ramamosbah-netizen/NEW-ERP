import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
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
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[950] flex items-center justify-center p-4">
      {/* Modal Card wrapper */}
      <div
        className={`w-full ${sizeClasses[size]} bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in-0 zoom-in-95 duration-100`}
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

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-5 select-text custom-scrollbar">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex justify-end items-center gap-2 border-t border-[var(--border-color)] px-5 py-3 bg-[var(--bg-dark)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
