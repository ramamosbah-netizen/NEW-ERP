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
  description = 'There is nothing to display here yet.',
  icon: Icon = Inbox,
  actionText,
  onAction,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 py-12 border border-dashed border-[var(--border-color)] rounded-lg bg-[var(--bg-card-hover)] ${className}`}>
      <div className="h-10 w-10 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] mb-3">
        <Icon size={20} />
      </div>
      <h3 className="font-medium text-[var(--text-primary)] text-sm mb-1">{title}</h3>
      <p className="text-[var(--text-muted)] text-xs max-w-xs leading-relaxed mb-4">{description}</p>
      {actionText && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
};
