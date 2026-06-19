'use client';

// ============================================================
// Aura ERP — Active-company context (Multi-Company Phase 0b)
// Loads the companies the signed-in user belongs to and tracks the "active"
// company (persisted per browser). Modules consume `useCompany()` to scope
// reads/writes by the active company as per-module scoping rolls out.
// Membership is the access boundary (RLS auth_company_ids); the active company
// is purely a UI lens over the companies the user already has access to.
// ============================================================

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { companyService, type Company } from '@/services/companyService';

interface CompanyContextValue {
  companies: Company[];
  activeCompany: Company | null;
  activeCompanyId: string | null;
  setActiveCompany: (id: string) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);
const STORAGE_KEY = 'erp-active-company';

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const cos = await companyService.getMyCompanies();
      const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      const next = (stored && cos.some(c => c.id === stored) ? stored : cos[0]?.id) || null;
      setCompanies(cos);
      setActiveId(next);
    } catch {
      setCompanies([]);
      setActiveId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { (async () => { await refresh(); })(); }, [refresh]);

  const setActiveCompany = useCallback((id: string) => {
    setActiveId(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
  }, []);

  const activeCompany = companies.find(c => c.id === activeCompanyId) || null;

  return (
    <CompanyContext.Provider value={{ companies, activeCompany, activeCompanyId, setActiveCompany, loading, refresh }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany(): CompanyContextValue {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within a CompanyProvider');
  return ctx;
}
