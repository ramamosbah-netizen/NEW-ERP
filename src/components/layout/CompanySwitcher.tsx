'use client';

// ============================================================
// Aura ERP — Company switcher (topbar, Multi-Company Phase 0b)
// Lets a user with access to more than one company choose the active one.
// With a single company it renders a static context chip. Hidden when the user
// has no company yet (e.g. before the Phase 0 backfill).
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCompany } from '@/lib/company/useCompany';
import { Building2, ChevronDown, Check, Settings as SettingsIcon } from 'lucide-react';

export default function CompanySwitcher() {
  const { companies, activeCompany, setActiveCompany, loading } = useCompany();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (loading || companies.length === 0) return null;

  // Single company → static context chip (no dropdown needed).
  if (companies.length === 1) {
    return (
      <div className="hidden md:flex items-center gap-1.5 px-2.5 h-8 rounded-md bg-[var(--bg-dark)] border border-[var(--border-color)] text-[11px] font-semibold text-[var(--text-secondary)] select-none">
        <Building2 size={12} className="text-[var(--text-muted)]" />
        <span className="truncate max-w-[120px]">{companies[0].name}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 h-8 rounded-md bg-[var(--bg-dark)] border border-[var(--border-color)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-colors"
        title="Active company"
      >
        <Building2 size={12} className="text-[var(--text-muted)]" />
        <span className="truncate max-w-[140px]">{activeCompany?.name || 'Select company'}</span>
        <ChevronDown size={12} className="opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl p-2 z-[100] animate-fadeIn">
          <div className="px-2 py-1 text-[9px] font-mono uppercase tracking-wider text-[var(--text-muted)]">Active company</div>
          <div className="flex flex-col max-h-[280px] overflow-y-auto">
            {companies.map(c => {
              const isActive = c.id === activeCompany?.id;
              return (
                <button
                  key={c.id}
                  onClick={() => { setActiveCompany(c.id); setOpen(false); }}
                  className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-[var(--bg-card-hover)] transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[var(--text-primary)] truncate">{c.name}</div>
                    {c.code && <div className="text-[10px] font-mono text-[var(--text-muted)]">{c.code}</div>}
                  </div>
                  {isActive && <Check size={14} className="text-[var(--primary)] flex-shrink-0" />}
                </button>
              );
            })}
          </div>
          <div className="border-t border-[var(--border-color)] mt-1 pt-1">
            <button
              onClick={() => { setOpen(false); router.push('/admin/companies'); }}
              className="flex items-center gap-2 px-2.5 py-2 w-full rounded-lg text-left text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
            >
              <SettingsIcon size={12} className="text-[var(--text-muted)]" /> Manage companies
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
