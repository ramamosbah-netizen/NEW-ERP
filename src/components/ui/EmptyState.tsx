import React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string; size?: number }>;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No records found',
  description = 'There is no data to display in this list view at the moment.',
  icon: Icon = Inbox,
  actionText,
  onAction,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 border border-dashed border-white/8 rounded-xl bg-white/1 px-6 py-12 ${className}`}>
      <div className="h-12 w-12 rounded-xl bg-white/3 border border-white/6 flex items-center justify-center text-slate-500 mb-4 animate-pulse">
        <Icon size={24} />
      </div>
      <h3 className="font-heading font-semibold text-white text-base leading-5 mb-1">
        {title}
      </h3>
      <p className="text-slate-400 text-xs max-w-sm mb-4 leading-normal">
        {description}
      </p>
      {actionText && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
};
