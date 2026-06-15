'use client';

// ============================================================
// JEET ERP — Warehouse: Installed Assets Tracking
// Serialized assets deployed (issued/installed) at project sites:
// what is where, warranty status (feeds project DLP). No migration.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import stockService from '@/services/stockService';
import { supabase } from '@/lib/supabase';
import type { SerialUnit, StockItem } from '@/types/stock.types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { HardHat, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const DAY = 86400000;
const DEPLOYED = ['ISSUED', 'INSTALLED'];

export default function InstalledAssetsPage() {
  const [serials, setSerials] = useState<SerialUnit[]>([]);
  const [itemMap, setItemMap] = useState<Map<string, StockItem>>(new Map());
  const [projectMap, setProjectMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [units, items] = await Promise.all([
          stockService.getSerialUnits().catch(() => [] as SerialUnit[]),
          stockService.getStockItems().catch(() => [] as StockItem[]),
        ]);
        const deployed = units.filter(u => DEPLOYED.includes(u.status));
        setSerials(deployed);
        setItemMap(new Map(items.map(it => [it.id, it])));
        const pids = [...new Set(deployed.map(u => u.project_id).filter(Boolean))] as string[];
        if (pids.length) {
          const { data } = await supabase.from('projects').select('id, project_number, name').in('id', pids);
          setProjectMap(new Map((data || []).map((p: any) => [p.id, `${p.project_number} — ${p.name}`])));
        }
      } finally { setLoading(false); }
    })();
  }, []);

  const projectLabel = (id?: string | null) => (id && projectMap.get(id)) || '— Unassigned —';
  const wDays = (exp?: string | null) => exp ? Math.ceil((new Date(exp).getTime() - Date.now()) / DAY) : null;

  const rows = useMemo(() => projectFilter ? serials.filter(s => (s.project_id || '') === projectFilter) : serials, [serials, projectFilter]);
  const projectOptions = useMemo(() => [...new Set(serials.map(s => s.project_id).filter(Boolean))] as string[], [serials]);

  const expiring = serials.filter(s => { const d = wDays(s.warranty_expiry); return d !== null && d >= 0 && d <= 90; }).length;
  const expired = serials.filter(s => { const d = wDays(s.warranty_expiry); return d !== null && d < 0; }).length;

  const byProject = useMemo(() => {
    const m = new Map<string, number>();
    serials.forEach(s => { const k = projectLabel(s.project_id); m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].map(([name, count]) => ({ name: name.split(' — ')[0], count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [serials, projectMap]);

  const exportCols = ['Serial', 'Item', 'Description', 'Status', 'Project', 'Location', 'Warranty expiry'];
  const exportRows = rows.map(s => { const it = itemMap.get(s.stock_item_id); return [s.serial_no, it?.item_code || '', it?.description || '', s.status, projectLabel(s.project_id), s.location_name || '', s.warranty_expiry ? s.warranty_expiry.slice(0, 10) : '']; });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Installed Assets Tracking"
        subtitle="Serialized assets deployed at project sites and their warranty status"
        breadcrumbs={[{ label: 'Warehouse', href: '/warehouse' }, { label: 'Installed Assets' }]}
        actions={rows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Installed Assets', columns: exportCols, rows: exportRows, fileName: 'installed-assets' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Installed Assets', columns: exportCols, rows: exportRows, fileName: 'installed-assets' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : serials.length === 0 ? (
        <Card><EmptyState icon={HardHat} title="No deployed assets" description="Serialized items issued or installed at project sites appear here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Deployed assets</div><div className="text-2xl font-bold mt-1">{serials.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Projects</div><div className="text-2xl font-bold mt-1">{projectOptions.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Warranty ≤90d</div><div className="text-2xl font-bold mt-1" style={{ color: expiring ? 'var(--status-warning-text)' : 'var(--text-primary)' }}>{expiring}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Warranty expired</div><div className="text-2xl font-bold mt-1" style={{ color: expired ? 'var(--status-danger-text)' : 'var(--text-primary)' }}>{expired}</div></Card>
          </div>

          {byProject.length > 1 && (
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Deployed assets by project</div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={byProject}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <Card className="p-4">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Project filter</label>
            <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="w-full md:max-w-md mt-1 px-3 h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm">
              <option value="">All projects</option>{projectOptions.map(id => <option key={id} value={id}>{projectLabel(id)}</option>)}
            </select>
          </Card>

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs">
                <th className="p-3">Serial</th><th className="p-3">Item</th><th className="p-3">Status</th>
                <th className="p-3">Project</th><th className="p-3">Location</th><th className="p-3">Warranty</th>
              </tr></thead>
              <tbody>
                {rows.map(s => { const it = itemMap.get(s.stock_item_id); const d = wDays(s.warranty_expiry); const wc = d === null ? 'var(--text-tertiary)' : d < 0 ? 'var(--status-danger-text)' : d <= 90 ? 'var(--status-warning-text)' : 'var(--text-secondary)'; return (
                  <tr key={s.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3 font-mono text-xs text-[var(--text-primary)]">{s.serial_no}</td>
                    <td className="p-3"><div className="text-[var(--text-primary)]">{it?.item_code || '—'}</div><div className="text-[11px] text-[var(--text-tertiary)] line-clamp-1">{it?.description}</div></td>
                    <td className="p-3 text-xs">{s.status}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{projectLabel(s.project_id)}</td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{s.location_name || '—'}</td>
                    <td className="p-3 text-xs" style={{ color: wc }}>{s.warranty_expiry ? (d !== null && d < 0 ? `Expired ${s.warranty_expiry.slice(0, 10)}` : s.warranty_expiry.slice(0, 10)) : '—'}</td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
