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
    <div className="fixed inset-0 bg-[#060814]/75 backdrop-blur-sm z-[950] flex justify-end">
      {/* Backdrop closer click */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      {/* Drawer content board */}
      <div
        className={`w-full ${sizeClasses[size]} h-full bg-[#0a0e24] border-l border-white/8 shadow-2xl shadow-black/80 flex flex-col justify-between animate-in slide-in-from-right duration-250`}
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

        {/* Scrolling content */}
        <div className="flex-1 overflow-y-auto p-5 select-text custom-scrollbar">
          {children}
        </div>

        {/* Footer sticky bar */}
        {footer && (
          <div className="flex justify-end items-center gap-2 border-t border-white/6 px-5 py-3 bg-[#0b0f2a]/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
