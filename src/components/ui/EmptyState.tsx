import React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string; size?: number }>;
  actionText?: string;
  onAction?: () => void;
  /** Primary CTA style — defaults to the inviting primary button. */
  actionVariant?: 'primary' | 'secondary';
  /** Optional secondary action (e.g. "Learn more" / "Import"). */
  secondaryText?: string;
  onSecondary?: () => void;
  className?: string;
}

/**
 * Friendly empty state: a tinted icon, a clear headline, a helpful line of
 * guidance, and (optionally) the next action — so a blank screen always tells
 * the user what to do next instead of just "no data". Used across ~112 lists.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Nothing here yet',
  description = 'There is nothing to display here yet.',
  icon: Icon = Inbox,
  actionText,
  onAction,
  actionVariant = 'primary',
  secondaryText,
  onSecondary,
  className = '',
}) => {
  const hasActions = (actionText && onAction) || (secondaryText && onSecondary);
  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-6 py-12 border border-dashed border-[var(--border-color)] rounded-lg bg-[var(--bg-card-hover)] ${className}`}
    >
      <div
        className="h-14 w-14 rounded-full flex items-center justify-center mb-4"
        style={{ background: 'var(--surface-active, var(--bg-card))', color: 'var(--accent, var(--text-muted))' }}
      >
        <Icon size={24} />
      </div>
      <h3 className="font-semibold text-[var(--text-primary)] text-sm mb-1">{title}</h3>
      <p className="text-[var(--text-muted)] text-xs max-w-sm leading-relaxed mb-4">{description}</p>
      {hasActions && (
        <div className="flex items-center gap-2">
          {actionText && onAction && (
            <Button variant={actionVariant} size="sm" onClick={onAction}>{actionText}</Button>
          )}
          {secondaryText && onSecondary && (
            <Button variant="muted" size="sm" onClick={onSecondary}>{secondaryText}</Button>
          )}
        </div>
      )}
    </div>
  );
};
