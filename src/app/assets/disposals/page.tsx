'use client';

// ============================================================
// JEET ERP — Asset Disposals & Gain/Loss
// Disposal P&L (proceeds vs NBV), method mix and monthly trend.
// Read-only; PDF + Excel export.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportTablePdf, exportTableExcel } from '@/lib/finance-export';
import { Trash2, FileDown, Sheet } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, PieChart, Pie, Legend } from 'recharts';

const fmtAED = (n: number) => 'AED ' + Math.round(n || 0).toLocaleString('en-AE');
const PIE = ['var(--accent)', 'var(--status-info-text)', 'var(--status-success-text)', 'var(--status-warning-text)'];

interface Disp { id: string; asset_id: string; disposal_date: string; method: string; proceeds: number; nbv_at_disposal: number; gain_loss: number; buyer: string | null; }

export default function DisposalsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Disp[]>([]);
  const [aMap, setAMap] = useState<Map<string, { num: string; name: string }>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('asset_disposals').select('id, asset_id, disposal_date, method, proceeds, nbv_at_disposal, gain_loss, buyer').order('disposal_date', { ascending: false });
        const r = (data || []) as Disp[];
        setRows(r);
        const ids = [...new Set(r.map(x => x.asset_id).filter(Boolean))];
        if (ids.length) { const { data: a } = await supabase.from('fixed_assets').select('id, asset_number, name').in('id', ids); setAMap(new Map((a || []).map((x: any) => [x.id, { num: x.asset_number, name: x.name }]))); }
      } finally { setLoading(false); }
    })();
  }, []);

  const totalProceeds = rows.reduce((a, r) => a + (r.proceeds || 0), 0);
  const totalNbv = rows.reduce((a, r) => a + (r.nbv_at_disposal || 0), 0);
  const netGainLoss = rows.reduce((a, r) => a + (r.gain_loss || 0), 0);
  const gains = rows.filter(r => (r.gain_loss || 0) > 0).length;
  const losses = rows.filter(r => (r.gain_loss || 0) < 0).length;

  const byMethod = useMemo(() => { const m = new Map<string, { count: number; gl: number }>(); rows.forEach(r => { const c = m.get(r.method) || { count: 0, gl: 0 }; c.count++; c.gl += r.gain_loss || 0; m.set(r.method, c); }); return [...m.entries()].map(([name, v]) => ({ name: name.replace(/_/g, ' '), value: v.count, gl: Math.round(v.gl) })); }, [rows]);
  const byMonth = useMemo(() => { const m = new Map<string, number>(); rows.forEach(r => { if (!r.disposal_date) return; const k = r.disposal_date.slice(0, 7); m.set(k, (m.get(k) || 0) + (r.gain_loss || 0)); }); return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([k, v]) => ({ month: k.slice(2), value: Math.round(v) })); }, [rows]);

  const exportCols = ['Date', 'Asset #', 'Name', 'Method', 'Proceeds', 'NBV', 'Gain/Loss', 'Buyer'];
  const exportRows = rows.map(r => [r.disposal_date, aMap.get(r.asset_id)?.num || '', aMap.get(r.asset_id)?.name || '', r.method, Math.round(r.proceeds), Math.round(r.nbv_at_disposal), Math.round(r.gain_loss), r.buyer || '']);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Disposals & Gain/Loss"
        subtitle="Disposal P&L, method mix and monthly trend"
        breadcrumbs={[{ label: 'Fleet & Assets', href: '/fleet/hub' }, { label: 'Disposals' }]}
        actions={rows.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="secondary" icon={FileDown} onClick={() => exportTablePdf({ title: 'Asset Disposals', columns: exportCols, rows: exportRows, fileName: 'asset-disposals' })}>PDF</Button>
            <Button variant="secondary" icon={Sheet} onClick={() => exportTableExcel({ title: 'Asset Disposals', columns: exportCols, rows: exportRows, fileName: 'asset-disposals' })}>Excel</Button>
          </div>
        ) : undefined}
      />

      {loading ? (
        <Card><div className="p-8 text-center text-sm text-[var(--text-tertiary)]">Loading…</div></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={Trash2} title="No disposals" description="Asset disposals, proceeds and gain/loss on sale will be analysed here." /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Disposals</div><div className="text-2xl font-bold mt-1">{rows.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Proceeds</div><div className="text-xl font-bold mt-1">{fmtAED(totalProceeds)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">NBV disposed</div><div className="text-xl font-bold mt-1">{fmtAED(totalNbv)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Net gain / loss</div><div className="text-xl font-bold mt-1" style={{ color: netGainLoss >= 0 ? 'var(--status-success-text)' : 'var(--status-danger-text)' }}>{netGainLoss >= 0 ? '+' : ''}{fmtAED(netGainLoss)}</div></Card>
            <Card className="p-4"><div className="text-xs text-[var(--text-secondary)]">Gains / losses</div><div className="text-2xl font-bold mt-1"><span style={{ color: 'var(--status-success-text)' }}>{gains}</span> / <span style={{ color: 'var(--status-danger-text)' }}>{losses}</span></div></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Disposals by method</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={byMethod} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} fontSize={11}>{byMethod.map((e, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie>
                    <Legend wrapperStyle={{ fontSize: 11 }} /><Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">Gain/Loss per month</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={byMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
                    <Tooltip formatter={(v: any) => fmtAED(Number(v))} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>{byMonth.map((e, i) => <Cell key={i} fill={e.value >= 0 ? 'var(--status-success-text)' : 'var(--status-danger-text)'} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="p-0 overflow-x-auto">
            <div className="p-3 text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border)]">Disposals ({rows.length})</div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)] text-xs"><th className="p-3">Date</th><th className="p-3">Asset</th><th className="p-3">Method</th><th className="p-3 text-right">Proceeds</th><th className="p-3 text-right">NBV</th><th className="p-3 text-right">Gain/Loss</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] cursor-pointer" onClick={() => router.push(`/assets/${r.asset_id}`)}>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{r.disposal_date}</td>
                    <td className="p-3"><div className="font-medium text-[var(--text-primary)]">{aMap.get(r.asset_id)?.num || '—'}</div><div className="text-[11px] text-[var(--text-tertiary)]">{aMap.get(r.asset_id)?.name || ''}</div></td>
                    <td className="p-3 text-xs text-[var(--text-secondary)]">{r.method?.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-right text-xs text-[var(--text-secondary)]">{fmtAED(r.proceeds)}</td>
                    <td className="p-3 text-right text-xs text-[var(--text-secondary)]">{fmtAED(r.nbv_at_disposal)}</td>
                    <td className="p-3 text-right text-xs font-medium" style={{ color: (r.gain_loss || 0) >= 0 ? 'var(--status-success-text)' : 'var(--status-danger-text)' }}>{(r.gain_loss || 0) >= 0 ? '+' : ''}{fmtAED(r.gain_loss)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
