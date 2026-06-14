'use client';

// ============================================================
// JEET ERP — Suppliers & Subcontractors Registry
// Register, manage and score suppliers from PO history. Any
// supplier created here (or auto-created elsewhere, e.g. when
// generating LPOs from a comparison) appears in this registry.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import warehouseService, { SupplierRow } from '@/services/warehouseService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Users, Plus, Search, Star, Power, X, Save, Award } from 'lucide-react';

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  SUPPLIER: { label: 'Supplier', cls: 'q-badge-draft' },
  SUBCONTRACTOR: { label: 'Subcon', cls: 'q-badge-revised' },
  BOTH: { label: 'Supplier + Subcon', cls: 'q-badge-pending_commercial' },
};

const scoreColor = (s: number) =>
  s >= 75 ? 'success' : s >= 50 ? 'warning' : 'danger';
const COLORS: Record<string, { bg: string; text: string; border: string }> = {
  success: { bg: 'var(--status-success-bg)', text: 'var(--status-success-text)', border: 'var(--status-success-border)' },
  warning: { bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)', border: 'var(--status-warning-border)' },
  danger: { bg: 'var(--status-danger-bg)', text: 'var(--status-danger-text)', border: 'var(--status-danger-border)' },
};

const fmtAED = (v: number) => new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(v) + ' AED';

export default function SuppliersPage() {
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', contact_person: '', phone: '', email: '', payment_terms_days: 30, preferred: false, supplier_type: 'SUPPLIER' as 'SUPPLIER' | 'SUBCONTRACTOR' | 'BOTH', trade: '', day_rate: '' });
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setRows(await warehouseService.getSuppliers());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy('add');
    try {
      await warehouseService.createSupplier({
        ...form,
        trade: form.trade || undefined,
        day_rate: form.day_rate ? Number(form.day_rate) : null,
      });
      setShowAdd(false);
      setForm({ name: '', contact_person: '', phone: '', email: '', payment_terms_days: 30, preferred: false, supplier_type: 'SUPPLIER', trade: '', day_rate: '' });
      await load();
    } catch (err: any) {
      setError(err.message?.includes('audit_log') || err.message?.includes('table_name')
        ? 'Supplier could not be saved — apply migration 20260613160000 (pricing audit trigger fix) in the SQL editor.'
        : err.message || 'Failed to create supplier');
    } finally {
      setBusy(null);
    }
  };

  const toggleActive = async (s: SupplierRow) => {
    setBusy(s.id);
    try { await warehouseService.toggleSupplierActive(s.id, !s.is_active); await load(); }
    catch (err: any) { setError(err.message || 'Failed'); }
    finally { setBusy(null); }
  };

  const filtered = rows.filter(r =>
    !search ||
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.contact_person || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalSpend = rows.reduce((s, r) => s + r.total_value, 0);
  const activeCount = rows.filter(r => r.is_active).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Suppliers & Subcontractors"
        subtitle="Registry, management and historic performance scoring — suppliers created anywhere in the system appear here"
        breadcrumbs={[{ label: 'Warehouse', href: '/warehouse' }, { label: 'Suppliers' }]}
        actions={<Button variant="primary" size="sm" icon={Plus} onClick={() => setShowAdd(true)}>Register supplier</Button>}
      />

      {error && (
        <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Suppliers', value: rows.length },
          { label: 'Active', value: activeCount },
          { label: 'Total PO spend', value: fmtAED(totalSpend) },
          { label: 'Preferred', value: rows.filter(r => r.preferred).length },
        ].map(k => (
          <div key={k.label} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-3">
            <span className="text-xs text-[var(--text-muted)] block">{k.label}</span>
            <span className="text-lg font-semibold text-[var(--text-primary)]">{k.value}</span>
          </div>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
        <input className="quote-form-input w-full !pl-9" placeholder="Search by name, contact, email…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><div className="h-7 w-7 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin rounded-full" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="No suppliers" description="Register your first supplier or subcontractor." actionText="Register supplier" onAction={() => setShowAdd(true)} />
      ) : (
        <Card padding={false}>
          <div className="quote-table-wrap !border-0 !rounded-none">
            <table className="quote-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Contact</th>
                  <th>Score</th>
                  <th>Orders</th>
                  <th>Total value</th>
                  <th>On-time</th>
                  <th>Terms</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const c = COLORS[scoreColor(s.score)];
                  return (
                    <tr key={s.id} style={{ opacity: s.is_active ? 1 : 0.5 }}>
                      <td>
                        <div className="flex items-center gap-1.5">
                          {s.preferred && <Star size={12} className="text-[var(--warning)]" fill="currentColor" />}
                          <button onClick={() => router.push(`/warehouse/suppliers/${s.id}`)} className="font-medium text-[var(--primary)] text-xs hover:underline cursor-pointer text-left">{s.name}</button>
                          <span className={`q-badge ${(TYPE_BADGE[s.supplier_type] || TYPE_BADGE.SUPPLIER).cls} !text-[0.625rem]`}>
                            {(TYPE_BADGE[s.supplier_type] || TYPE_BADGE.SUPPLIER).label}
                          </span>
                        </div>
                        <span className="text-[0.6875rem] text-[var(--text-muted)]">
                          {s.trade ? `${s.trade}${s.day_rate != null ? ` · ${s.day_rate} AED/day` : ''}` : (s.systems_covered && s.systems_covered.length > 0 ? s.systems_covered.join(', ') : '')}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-col">
                          <span className="text-xs text-[var(--text-secondary)]">{s.contact_person || '—'}</span>
                          <span className="text-[0.6875rem] text-[var(--text-muted)]">{s.email || s.phone || ''}</span>
                        </div>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border"
                          style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}>
                          <Award size={11} /> {s.score}
                        </span>
                      </td>
                      <td><span className="font-mono text-xs">{s.po_count}</span></td>
                      <td><span className="font-mono text-xs">{s.total_value > 0 ? fmtAED(s.total_value) : '—'}</span></td>
                      <td><span className="font-mono text-xs text-[var(--text-secondary)]">{s.on_time_pct != null ? s.on_time_pct + '%' : '—'}</span></td>
                      <td><span className="text-xs text-[var(--text-secondary)]">{s.payment_terms_days ?? 30}d</span></td>
                      <td>
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="muted" icon={Power} disabled={busy !== null} onClick={() => toggleActive(s)} title={s.is_active ? 'Deactivate' : 'Activate'} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showAdd && (
        <div className="quote-modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="quote-modal" onClick={e => e.stopPropagation()}>
            <div className="quote-modal-header">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Register supplier / subcontractor</h3>
              <button onClick={() => setShowAdd(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleAdd} className="quote-modal-body flex flex-col gap-4">
              <div className="quote-form-grid">
                <div className="quote-form-group">
                  <label>Name *</label>
                  <input className="quote-form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Supplier / subcontractor name" />
                </div>
                <div className="quote-form-group">
                  <label>Type</label>
                  <select className="quote-form-input" value={form.supplier_type} onChange={e => setForm({ ...form, supplier_type: e.target.value as any })}>
                    <option value="SUPPLIER">Material supplier</option>
                    <option value="SUBCONTRACTOR">Subcontractor</option>
                    <option value="BOTH">Both</option>
                  </select>
                </div>
                {(form.supplier_type === 'SUBCONTRACTOR' || form.supplier_type === 'BOTH') && (
                  <>
                    <div className="quote-form-group">
                      <label>Trade</label>
                      <input className="quote-form-input" value={form.trade} onChange={e => setForm({ ...form, trade: e.target.value })} placeholder="e.g. Electrical, MEP, Civil" />
                    </div>
                    <div className="quote-form-group">
                      <label>Manpower day rate (AED)</label>
                      <input type="number" className="quote-form-input" value={form.day_rate} onChange={e => setForm({ ...form, day_rate: e.target.value })} placeholder="e.g. 350" />
                    </div>
                  </>
                )}
                <div className="quote-form-group">
                  <label>Contact person</label>
                  <input className="quote-form-input" value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} />
                </div>
                <div className="quote-form-group">
                  <label>Phone</label>
                  <input className="quote-form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="quote-form-group">
                  <label>Email</label>
                  <input className="quote-form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="quote-form-group">
                  <label>Payment terms (days)</label>
                  <input className="quote-form-input" type="number" value={form.payment_terms_days} onChange={e => setForm({ ...form, payment_terms_days: Number(e.target.value) })} />
                </div>
                <div className="quote-form-group">
                  <label className="flex items-center gap-2 cursor-pointer mt-6">
                    <input type="checkbox" checked={form.preferred} onChange={e => setForm({ ...form, preferred: e.target.checked })} />
                    Preferred supplier
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button variant="primary" size="sm" type="submit" icon={Save} isLoading={busy === 'add'}>Register</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
