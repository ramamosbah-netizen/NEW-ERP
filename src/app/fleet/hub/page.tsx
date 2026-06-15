'use client';

// ============================================================
// JEET ERP — Fleet & Assets Hub
// Command center: live roll-up across vehicles, compliance, fines,
// fixed assets and tools, plus quick links to every analytics page.
// Read-only; batched plain queries (no migration).
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import {
  Car, Calculator, Wrench, ShieldAlert, Fuel, Gauge, TrendingDown,
  Trash2, Award, LayoutGrid, ChevronRight, AlertTriangle,
} from 'lucide-react';

const fmtAED = (n: number) => 'AED ' + (n || 0).toLocaleString('en-AE', { maximumFractionDigits: 0 });
const daysUntil = (d?: string | null) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null;

interface Tile { href: string; label: string; desc: string; icon: React.ComponentType<{ size?: number | string; className?: string }>; }
const TILES: Tile[] = [
  { href: '/fleet/dashboard', label: 'Fleet Dashboard', desc: 'Status, type, ownership, value', icon: Car },
  { href: '/fleet/compliance', label: 'Compliance Tracker', desc: 'Registration & insurance expiry', icon: ShieldAlert },
  { href: '/fleet/fuel-analytics', label: 'Fuel Analytics', desc: 'Spend, efficiency, anomalies', icon: Fuel },
  { href: '/fleet/fines-analytics', label: 'Fines Analytics', desc: 'Unpaid exposure, black points', icon: AlertTriangle },
  { href: '/fleet/maintenance', label: 'Maintenance & Downtime', desc: 'Cost, downtime, service due', icon: Wrench },
  { href: '/fleet/tco', label: 'Total Cost of Ownership', desc: 'Cost per km per vehicle', icon: Gauge },
  { href: '/assets/dashboard', label: 'Fixed Asset Dashboard', desc: 'NBV vs cost, category mix', icon: Calculator },
  { href: '/assets/depreciation-forecast', label: 'Depreciation Forecast', desc: 'Projected NBV run-off', icon: TrendingDown },
  { href: '/assets/disposals', label: 'Disposals & Gain/Loss', desc: 'Disposal P&L', icon: Trash2 },
  { href: '/tools', label: 'Tools & Equipment', desc: 'Register, custody, condition', icon: LayoutGrid },
  { href: '/tools/calibration', label: 'Calibration Tracker', desc: 'Instruments due / overdue', icon: Award },
];

export default function FleetAssetsHubPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [s, setS] = useState({
    vehicles: 0, vActive: 0, vWorkshop: 0,
    fleetValue: 0, assets: 0, nbv: 0, tools: 0,
    unpaidFines: 0, unpaidCount: 0,
    complianceAlerts: 0, calibrationDue: 0,
  });

  useEffect(() => {
    (async () => {
      try {
        const [veh, fin, asset, tool] = await Promise.all([
          supabase.from('vehicles').select('status, purchase_cost, registration_expiry, insurance_expiry').eq('is_active', true),
          supabase.from('vehicle_fines').select('amount, status'),
          supabase.from('fixed_assets').select('acquisition_cost, net_book_value, status').eq('is_active', true),
          supabase.from('tools').select('requires_calibration, next_calibration_due, status').eq('is_active', true),
        ]);
        const vehicles = veh.data || [];
        const fines = fin.data || [];
        const assets = asset.data || [];
        const tools = tool.data || [];
        const compAlerts = vehicles.filter(v => {
          const r = daysUntil(v.registration_expiry); const i = daysUntil(v.insurance_expiry);
          return (r !== null && r <= 30) || (i !== null && i <= 30);
        }).length;
        const calDue = tools.filter(t => t.requires_calibration && t.status !== 'RETIRED' && (() => { const d = daysUntil(t.next_calibration_due); return d !== null && d <= 30; })()).length;
        const unpaid = fines.filter(f => f.status === 'UNPAID' || f.status === 'DISPUTED');
        setS({
          vehicles: vehicles.length,
          vActive: vehicles.filter(v => v.status === 'ACTIVE').length,
          vWorkshop: vehicles.filter(v => v.status === 'IN_WORKSHOP').length,
          fleetValue: vehicles.reduce((a, v) => a + (v.purchase_cost || 0), 0),
          assets: assets.length,
          nbv: assets.reduce((a, x) => a + (x.net_book_value || 0), 0),
          tools: tools.length,
          unpaidFines: unpaid.reduce((a, f) => a + (f.amount || 0), 0),
          unpaidCount: unpaid.length,
          complianceAlerts: compAlerts,
          calibrationDue: calDue,
        });
      } finally { setLoading(false); }
    })();
  }, []);

  const kpis = useMemo(() => ([
    { label: 'Vehicles', value: s.vehicles, sub: `${s.vActive} active · ${s.vWorkshop} in workshop`, color: 'var(--accent)' },
    { label: 'Fleet value', value: fmtAED(s.fleetValue), sub: 'purchase cost', color: 'var(--text-primary)' },
    { label: 'Fixed assets (NBV)', value: fmtAED(s.nbv), sub: `${s.assets} assets`, color: 'var(--text-primary)' },
    { label: 'Tools', value: s.tools, sub: 'in register', color: 'var(--text-primary)' },
    { label: 'Unpaid fines', value: fmtAED(s.unpaidFines), sub: `${s.unpaidCount} open`, color: s.unpaidCount ? 'var(--status-danger-text)' : 'var(--text-primary)' },
    { label: 'Compliance alerts', value: s.complianceAlerts, sub: 'reg/insurance ≤30d', color: s.complianceAlerts ? 'var(--status-warning-text)' : 'var(--text-primary)' },
    { label: 'Calibration due', value: s.calibrationDue, sub: 'instruments ≤30d', color: s.calibrationDue ? 'var(--status-warning-text)' : 'var(--text-primary)' },
  ]), [s]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Fleet & Assets Hub" subtitle="Live roll-up across vehicles, fixed assets and tools" breadcrumbs={[{ label: 'Fleet & Assets' }, { label: 'Hub' }]} />

      {(s.complianceAlerts > 0 || s.unpaidCount > 0 || s.calibrationDue > 0) && (
        <Card className="p-4 border-l-4" style={{ borderLeftColor: 'var(--status-warning-text)' }}>
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] mb-2"><ShieldAlert size={16} /> Needs attention</div>
          <div className="flex flex-wrap gap-2">
            {s.complianceAlerts > 0 && <button onClick={() => router.push('/fleet/compliance')} className="text-xs px-3 py-1.5 rounded-md" style={{ background: 'var(--status-warning-bg)', color: 'var(--status-warning-text)' }}>{s.complianceAlerts} vehicle compliance item(s) ≤30 days →</button>}
            {s.unpaidCount > 0 && <button onClick={() => router.push('/fleet/fines-analytics')} className="text-xs px-3 py-1.5 rounded-md" style={{ background: 'var(--status-danger-bg)', color: 'var(--status-danger-text)' }}>{s.unpaidCount} unpaid fine(s) — {fmtAED(s.unpaidFines)} →</button>}
            {s.calibrationDue > 0 && <button onClick={() => router.push('/tools/calibration')} className="text-xs px-3 py-1.5 rounded-md" style={{ background: 'var(--status-warning-bg)', color: 'var(--status-warning-text)' }}>{s.calibrationDue} tool(s) due for calibration →</button>}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className="p-4">
            <div className="text-xs text-[var(--text-secondary)]">{k.label}</div>
            <div className="text-xl font-bold mt-1" style={{ color: k.color }}>{loading ? '—' : k.value}</div>
            <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{k.sub}</div>
          </Card>
        ))}
      </div>

      <div>
        <div className="text-sm font-semibold text-[var(--text-primary)] mb-2">Analytics</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TILES.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.href} onClick={() => router.push(t.href)} className="text-left">
                <Card className="p-4 hover:bg-[var(--surface-hover)] transition-colors h-full">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg" style={{ background: 'var(--surface-active)' }}><Icon size={18} className="text-[var(--accent)]" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 text-sm font-semibold text-[var(--text-primary)]">{t.label}<ChevronRight size={14} className="text-[var(--text-tertiary)]" /></div>
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5">{t.desc}</div>
                    </div>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
