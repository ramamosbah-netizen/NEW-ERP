// ============================================================
// JEET ERP — Design System: Toolbar + SearchInput
// The standard "filters / search / actions" row that sits above a
// table or list. Keeps every module's list view structurally identical.
// ============================================================

import React from 'react';
import { Search } from 'lucide-react';

interface ToolbarProps {
  /** Left-aligned controls (search, filters). */
  children?: React.ReactNode;
  /** Right-aligned controls (primary actions). */
  actions?: React.ReactNode;
  className?: string;
}

export const Toolbar: React.FC<ToolbarProps> = ({ children, actions, className = '' }) => (
  <div className={`flex flex-wrap items-center gap-2 mb-4 ${className}`}>
    <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">{children}</div>
    {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
  </div>
);

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({ containerClassName = '', className = '', ...props }) => (
  <div className={`relative ${containerClassName}`}>
    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
    <input
      type="search"
      className={
        `h-9 pl-8 pr-3 text-xs rounded-[var(--radius-lg)] bg-[var(--bg-card)] border border-[var(--border-color)] ` +
        `text-[var(--text-primary)] placeholder:text-[var(--text-muted)] ` +
        `focus:outline-none focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-glow)] ` +
        `transition-colors duration-100 min-w-[200px] ${className}`
      }
      {...props}
    />
  </div>
);

interface SelectFilterProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

/** Compact select styled to match SearchInput, for inline filters. */
export const SelectFilter: React.FC<SelectFilterProps> = ({ className = '', children, ...props }) => (
  <select
    className={
      `h-9 px-2.5 text-xs rounded-[var(--radius-lg)] bg-[var(--bg-card)] border border-[var(--border-color)] ` +
      `text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] ` +
      `focus:ring-2 focus:ring-[var(--accent-glow)] transition-colors duration-100 cursor-pointer ${className}`
    }
    {...props}
  >
    {children}
  </select>
);

export default Toolbar;
