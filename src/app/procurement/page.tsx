'use client';

// ============================================================
// JEET ERP — Procurement Hub
// Single entry point to the procurement suite with a live
// "needs attention" strip. Read-only; reuses existing tables.
// ============================================================

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import {
  LayoutDashboard, ClipboardList, Mail, Scale, ShoppingCart, PackageCheck,
  Coins, Users, Truck, ShieldAlert, PiggyBank, Receipt,
} from 'lucide-react';

const DAY = 86400000;
const PR_OPEN = ['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL'];
const PAID = ['PAID', 'CANCELLED', 'VOID'];

const MODULES = [
  { href: '/procurement/dashboard', icon: LayoutDashboard, title: 'Dashboard', desc: 'Spend, status & exceptions overview' },
  { href: '/procurement/pr', icon: ClipboardList, title: 'Purchase Requests', desc: 'Raise & approve PRs' },
  { href: '/procurement/rfq', icon: Mail, title: 'Quotation Requests', desc: 'RFQ to suppliers from a BOQ' },
  { href: '/procurement/comparisons', icon: Scale, title: 'Comparisons', desc: 'Compare quotes & award' },
  { href: '/procurement/po', icon: ShoppingCart, title: 'Purchase Orders', desc: 'Create, approve, send POs' },
  { href: '/procurement/grn', icon: PackageCheck, title: 'Goods Receipt', desc: 'Receive against POs' },
  { href: '/procurement/spend', icon: Coins, title: 'Spend Analysis', desc: 'By supplier / project / month' },
  { href: '/procurement/suppliers', icon: Users, title: 'Supplier Performance', desc: 'Volume, delivery, match' },
  { href: '/procurement/deliveries', icon: Truck, title: 'Delivery Tracking', desc: 'Open & overdue deliveries' },
  { href: '/procurement/pr-pipeline', icon: ClipboardList, title: 'PR Pipeline', desc: 'Approval & conversion' },
  { href: '/procurement/match', icon: ShieldAlert, title: '3-Way Match', desc: 'Invoice match exceptions' },
  { href: '/procurement/grn-analytics', icon: PackageCheck, title: 'GRN Analytics', desc: 'Receipts & pending' },
  { href: '/procurement/savings', icon: PiggyBank, title: 'Savings Analysis', desc: 'Comparison savings & margin' },
  { href: '/procurement/payables', icon: Receipt, title: 'Payables', desc: 'Outstanding supplier invoices' },
];

export default function ProcurementHub() {
  const [counts, setCounts] = useState<{ prPending: number; overdueDel: number; matchEx: number; overduePay: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const now = Date.now();
        const [pr, po, inv] = await Promise.all([
          supabase.from('purchase_requests').select('status'),
          supabase.from('purchase_orders').select('status, delivery_status, required_delivery_date'),
          supabase.from('supplier_invoices').select('status, total, amount_paid, due_date, match_status'),
        ]);
        const prPending = (pr.data || []).filter((p: any) => PR_OPEN.includes(p.status)).length;
        const overdueDel = (po.data || []).filter((p: any) => p.required_delivery_date && new Date(p.required_delivery_date).getTime() < now && p.delivery_status !== 'COMPLETE' && p.status !== 'CANCELLED').length;
        const matchEx = (inv.data || []).filter((i: any) => ['MISMATCH', 'EXCEPTION', 'FAILED'].includes((i.match_status || '').toUpperCase())).length;
        const overduePay = (inv.data || []).filter((i: any) => !PAID.includes((i.status || '').toUpperCase()) && Number(i.total || 0) - Number(i.amount_paid || 0) > 0 && i.due_date && new Date(i.due_date).getTime() < now).length;
        setCounts({ prPending, overdueDel, matchEx, overduePay });
      } catch { /* best effort */ }
    })();
  }, []);

  const attention = counts ? [
    { label: 'PRs pending approval', value: counts.prPending, href: '/procurement/pr-pipeline', warn: counts.prPending > 0 },
    { label: 'Overdue deliveries', value: counts.overdueDel, href: '/procurement/deliveries', warn: counts.overdueDel > 0 },
    { label: 'Match exceptions', value: counts.matchEx, href: '/procurement/match', warn: counts.matchEx > 0 },
    { label: 'Overdue payables', value: counts.overduePay, href: '/procurement/payables', warn: counts.overduePay > 0 },
  ] : [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Procurement" subtitle="Source-to-pay — requests, RFQs, comparisons, orders, receipts and analytics" />

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
