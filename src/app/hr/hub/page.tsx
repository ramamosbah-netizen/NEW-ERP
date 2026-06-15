'use client';

// ============================================================
// JEET ERP — HR & Workforce Hub
// Single entry point with a live "needs attention" strip.
// Read-only; reuses existing tables.
// ============================================================

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import {
  LayoutDashboard, Users, Shield, Wallet, Landmark, CalendarOff, Clock,
  HardHat, Award, GraduationCap, MapPin, FolderArchive,
} from 'lucide-react';

const DAY = 86400000;
const DOC_FIELDS = ['visa_expiry', 'labour_card_expiry', 'emirates_id_expiry', 'passport_expiry', 'medical_insurance_expiry', 'iloe_insurance_expiry', 'driving_license_expiry'];

const MODULES = [
  { href: '/hr/dashboard', icon: LayoutDashboard, title: 'HR Dashboard', desc: 'Headcount, compliance, payroll' },
  { href: '/hr', icon: Users, title: 'Employees', desc: 'Register & profiles' },
  { href: '/hr/compliance-tracker', icon: Shield, title: 'Doc Compliance', desc: 'Visa / EID / labour-card expiry' },
  { href: '/hr/workforce', icon: Users, title: 'Workforce Analytics', desc: 'Demographics & tenure' },
  { href: '/hr/manpower', icon: HardHat, title: 'Manpower', desc: 'Deployed vs bench by project' },
  { href: '/payroll/analytics', icon: Wallet, title: 'Payroll Analytics', desc: 'Cost trend & components' },
  { href: '/payroll/eosb-liability', icon: Landmark, title: 'EOSB Liability', desc: 'Gratuity accrual' },
  { href: '/hr/leave-analytics', icon: CalendarOff, title: 'Leave Analytics', desc: 'By type / department' },
  { href: '/timesheets/analytics', icon: Clock, title: 'Utilization', desc: 'Hours & OT' },
  { href: '/hr/labour-cost', icon: HardHat, title: 'Labour Cost', desc: 'Cost charged to projects' },
  { href: '/hr/certifications', icon: Award, title: 'Certifications', desc: 'SIRA & safety certs' },
  { href: '/hr/competency', icon: GraduationCap, title: 'Training & Competency', desc: 'Skill matrix & training' },
  { href: '/hr/attendance', icon: MapPin, title: 'Attendance & GPS', desc: 'Daily check-in/out' },
  { href: '/hr/documents', icon: FolderArchive, title: 'Documents Center', desc: 'Per-employee document register' },
];

export default function HrHub() {
  const [counts, setCounts] = useState<{ docExpiring: number; certExpiring: number; leavePending: number; tsPending: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const now = Date.now();
        const [em, cr, lv, ts] = await Promise.all([
          supabase.from('employees').select('*').eq('is_active', true),
          supabase.from('employee_certifications').select('expiry_date'),
          supabase.from('leave_requests').select('status').in('status', ['PENDING', 'SUBMITTED']),
          supabase.from('timesheets').select('status').in('status', ['SUBMITTED']),
        ]);
        let docExpiring = 0;
        (em.data || []).forEach((e: any) => DOC_FIELDS.forEach(f => { if (e[f]) { const d = Math.ceil((new Date(e[f]).getTime() - now) / DAY); if (d <= 30) docExpiring++; } }));
        const certExpiring = (cr.data || []).filter((c: any) => c.expiry_date && Math.ceil((new Date(c.expiry_date).getTime() - now) / DAY) <= 60).length;
        setCounts({ docExpiring, certExpiring, leavePending: (lv.data || []).length, tsPending: (ts.data || []).length });
      } catch { /* best effort */ }
    })();
  }, []);

  const attention = counts ? [
    { label: 'Docs expired / ≤30d', value: counts.docExpiring, href: '/hr/compliance-tracker', warn: counts.docExpiring > 0 },
    { label: 'Certs expiring ≤60d', value: counts.certExpiring, href: '/hr/certifications', warn: counts.certExpiring > 0 },
    { label: 'Leave pending', value: counts.leavePending, href: '/hr/leave-analytics', warn: counts.leavePending > 0 },
    { label: 'Timesheets pending', value: counts.tsPending, href: '/timesheets/analytics', warn: counts.tsPending > 0 },
  ] : [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="HR & Workforce" subtitle="Employees, compliance, payroll, training, attendance and analytics in one place" />

      {counts && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
