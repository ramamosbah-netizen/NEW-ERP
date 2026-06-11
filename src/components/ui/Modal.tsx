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
    <div className="fixed inset-0 bg-[#060814]/80 backdrop-blur-sm z-[950] flex items-center justify-center p-4">
      {/* Modal Card wrapper */}
      <div
        className={`w-full ${sizeClasses[size]} bg-[#0a0e24] border border-white/8 rounded-xl shadow-2xl shadow-black/70 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in-0 zoom-in-95 duration-200`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/6 px-5 py-4 gap-4">
          <h2 className="font-heading font-semibold text-white text-base truncate">
            {title || 'Details'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/4 transition-all"
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
          <div className="flex justify-end items-center gap-2 border-t border-white/6 px-5 py-3 bg-[#0b0f2a]/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
