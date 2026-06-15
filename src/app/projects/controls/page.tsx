'use client';

// ============================================================
// JEET ERP — Projects: Project Controls hub
// Single entry point to the enterprise PM suite, with a live
// "needs attention" strip. Read-only; reuses existing services.
// ============================================================

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import projectPortfolioService from '@/services/projectPortfolioService';
import warrantyService from '@/services/warrantyService';
import siteRecordsService from '@/services/siteRecordsService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import {
  ClipboardList, ListTree, GanttChartSquare, TrendingUp, Users, AlertTriangle,
  LayoutDashboard, ClipboardCheck, Shield, MessageSquare, BarChart3, Handshake, Camera,
} from 'lucide-react';

const MODULES = [
  { href: '/projects/dashboard', icon: LayoutDashboard, title: 'Executive Dashboard', desc: 'Portfolio health: cost, margin, progress, risk' },
  { href: '/projects/daily-reports', icon: ClipboardList, title: 'Daily Site Reports', desc: 'Manpower, weather, work done, photos' },
  { href: '/projects/wbs', icon: ListTree, title: 'WBS', desc: 'Work breakdown, budgets, rolled-up progress' },
  { href: '/projects/schedule', icon: GanttChartSquare, title: 'Schedule (Gantt)', desc: 'Timeline of work packages vs today' },
  { href: '/projects/evm', icon: TrendingUp, title: 'Progress & EVM', desc: 'PV/EV/AC, SPI/CPI, EAC' },
  { href: '/projects/resources', icon: Users, title: 'Resource Planning', desc: 'Manpower/equipment, utilization' },
  { href: '/projects/risks', icon: AlertTriangle, title: 'Risk Register', desc: '5×5 heat map, mitigation, owners' },
  { href: '/tc', icon: ClipboardCheck, title: 'Testing & Commissioning', desc: 'T&C packages, witness, certificates' },
  { href: '/projects/dlp', icon: Shield, title: 'DLP & Warranty', desc: 'Warranty expiry + DLP defects' },
  { href: '/projects/site-records', icon: MessageSquare, title: 'RFI / SI / NCR', desc: 'Information requests, instructions, NCRs' },
  { href: '/snags', icon: Camera, title: 'Snag List', desc: 'Raise and close site snags' },
  { href: '/projects/snag-analytics', icon: BarChart3, title: 'Snag Analytics & QA', desc: 'Quality KPIs and trends' },
  { href: '/handover', icon: Handshake, title: 'Handover', desc: 'Handover gates and certificate' },
];

export default function ProjectControlsHub() {
  const [counts, setCounts] = useState<{ highRisk: number; openRisks: number; expiring: number; openNcr: number; overdueRec: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [portfolio, warranties, records] = await Promise.all([
          projectPortfolioService.getPortfolio().catch(() => null),
          warrantyService.listWarranties().catch(() => []),
          siteRecordsService.list().catch(() => []),
        ]);
        setCounts({
          highRisk: portfolio?.totals.highRiskProjects || 0,
          openRisks: portfolio?.totals.openRisks || 0,
          expiring: warranties.filter(w => w.status === 'EXPIRING' || w.status === 'EXPIRED').length,
          openNcr: records.filter(r => r.doc_type === 'NCR' && (r.status === 'OPEN' || r.status === 'IN_PROGRESS')).length,
          overdueRec: records.filter(r => r.overdue).length,
        });
      } catch { /* best effort */ }
    })();
  }, []);

  const attention = counts ? [
    { label: 'High-risk projects', value: counts.highRisk, href: '/projects/risks', warn: counts.highRisk > 0 },
    { label: 'Open risks', value: counts.openRisks, href: '/projects/risks', warn: false },
    { label: 'Warranties expiring/expired', value: counts.expiring, href: '/projects/dlp', warn: counts.expiring > 0 },
    { label: 'Open NCRs', value: counts.openNcr, href: '/projects/site-records', warn: counts.openNcr > 0 },
    { label: 'Overdue RFI/SI/NCR', value: counts.overdueRec, href: '/projects/site-records', warn: counts.overdueRec > 0 },
  ] : [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Project Controls"
        subtitle="One place for site, schedule, cost, quality, risk and close-out controls"
        breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'Controls' }]}
      />

      {/* Needs attention */}
      {counts && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {attention.map((a, i) => (
            <Link key={i} href={a.href}>
              <Card className="p-4 hover:border-[var(--accent)] transition-colors">
                <div className="text-xs text-[var(--text-secondary)]">{a.label}</div>
                <div className="text-2xl font-bold mt-1" style={{ color: a.warn ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{a.value}</div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Module grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {MODULES.map(m => {
          const Icon = m.icon;
          return (
            <Link key={m.href} href={m.href}>
              <Card className="p-4 h-full hover:border-[var(--accent)] transition-colors flex items-start gap-3">
                <div className="p-2 rounded-lg shrink-0" style={{ background: 'var(--surface-active)' }}><Icon size={20} className="text-[var(--accent)]" /></div>
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">{m.title}</div>
                  <div className="text-[12px] text-[var(--text-tertiary)] mt-0.5">{m.desc}</div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
