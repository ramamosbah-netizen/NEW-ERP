'use client';

// ============================================================
// JEET ERP — Create Purchase Request
// ============================================================

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import prService, { PRCategory, PRItemInput } from '@/services/prService';
import { useCompany } from '@/lib/company/useCompany';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Plus, Trash2, Save, X } from 'lucide-react';

const CATEGORIES: { value: PRCategory; label: string }[] = [
  { value: 'PROJECT_MATERIAL', label: 'Project material' },
  { value: 'TOOLS', label: 'Tools' },
  { value: 'IT_EQUIPMENT', label: 'IT equipment' },
  { value: 'FURNITURE', label: 'Furniture' },
  { value: 'CONSUMABLES', label: 'Office consumables' },
  { value: 'SAMPLE', label: 'Sample' },
  { value: 'SERVICES', label: 'Services' },
  { value: 'OTHER', label: 'Other' },
];

const EMPTY_ITEM: PRItemInput = { description: '', brand: '', unit: 'Pcs', quantity: 1, estimated_unit_cost: 0, system: 'OTHER' };

export default function CreatePRPage() {
  const router = useRouter();
  const { activeCompanyId } = useCompany();
  const [projects, setProjects] = useState<{ id: string; project_number: string; name: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<PRCategory>('PROJECT_MATERIAL');
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [justification, setJustification] = useState('');
  const [requiredBy, setRequiredBy] = useState('');
  const [preferredSupplierId, setPreferredSupplierId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [items, setItems] = useState<PRItemInput[]>([{ ...EMPTY_ITEM }]);

  useEffect(() => {
    supabase.from('projects').select('id, project_number, name').eq('is_active', true).order('project_number', { ascending: false })
      .then(({ data }) => setProjects(data || []));
    supabase.from('pricing_suppliers').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setSuppliers(data || []));
  }, []);

  const isOverhead = category !== 'PROJECT_MATERIAL';
  const estTotal = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.estimated_unit_cost) || 0), 0);

  const updateItem = (idx: number, field: keyof PRItemInput, value: any) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));

  const handleSave = async (submit: boolean) => {
    if (!title.trim()) { setError('Title is required.'); return; }
    if (category === 'PROJECT_MATERIAL' && !projectId) { setError('Select a project, or choose a non-project category (tools, consumables…).'); return; }
    if (items.filter(i => i.description.trim()).length === 0) { setError('Add at least one item.'); return; }
    setSaving(true);
    try {
      const id = await prService.create({
        title: title.trim(),
        category,
        project_id: isOverhead ? null : projectId,
        justification: justification.trim() || undefined,
        required_by_date: requiredBy || null,
        preferred_supplier_id: preferredSupplierId || null,
        payment_method: paymentMethod || null,
        company_id: activeCompanyId || undefined,
        items: items.filter(i => i.description.trim()),
      });
      if (submit) await prService.submit(id);
      router.push(`/procurement/pr/${id}`);
    } catch (err: any) {
      setError(err.message?.includes('relation') || err.message?.includes('does not exist')
        ? 'PR tables not found — apply migration 20260613260000.'
        : err.message || 'Failed to save request');
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="New Purchase Request"
        subtitle="Request materials, tools, IT, furniture, consumables or samples — with or without a project"
        breadcrumbs={[{ label: 'Procurement', href: '/procurement/po' }, { label: 'Purchase Requests', href: '/procurement/pr' }, { label: 'New' }]}
        actions={<Button variant="secondary" size="sm" onClick={() => router.push('/procurement/pr')}>Cancel</Button>}
      />

      {error && (
        <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button>
        </div>
      )}

      <Card title="Request details">
        <div className="quote-form-grid">
          <div className="quote-form-group">
            <label>Category</label>
            <select className="quote-form-input" value={category} onChange={e => setCategory(e.target.value as PRCategory)}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          {!isOverhead && (
            <div className="quote-form-group">
              <label>Project *</label>
              <select className="quote-form-input" value={projectId} onChange={e => setProjectId(e.target.value)}>
                <option value="">Select project…</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.name}</option>)}
              </select>
            </div>
          )}
          {isOverhead && (
            <div className="quote-form-group">
              <label>Project (optional)</label>
              <select className="quote-form-input" value={projectId} onChange={e => setProjectId(e.target.value)}>
                <option value="">None (overhead)</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.project_number} — {p.name}</option>)}
              </select>
            </div>
          )}
          <div className="quote-form-group">
            <label>Title *</label>
            <input className="quote-form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Hand tools for site team" />
          </div>
          <div className="quote-form-group">
            <label>Required by</label>
            <input type="date" className="quote-form-input" value={requiredBy} onChange={e => setRequiredBy(e.target.value)} />
          </div>
          <div className="quote-form-group">
            <label>Preferred supplier (optional)</label>
            <select className="quote-form-input" value={preferredSupplierId} onChange={e => setPreferredSupplierId(e.target.value)}>
              <option value="">—</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="quote-form-group">
            <label>Mode of payment</label>
            <select className="quote-form-input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CASH">Cash</option>
              <option value="CREDIT">Credit (on account)</option>
              <option value="PETTY_CASH">Petty Cash</option>
              <option value="LC">Letter of Credit</option>
            </select>
          </div>
          <div className="quote-form-group col-span-full">
            <label>Justification</label>
            <textarea className="quote-form-textarea" rows={2} value={justification} onChange={e => setJustification(e.target.value)} placeholder="Why is this needed?" />
          </div>
        </div>
      </Card>

      <Card title="Requested items" headerActions={<Button size="sm" variant="secondary" icon={Plus} onClick={() => setItems(p => [...p, { ...EMPTY_ITEM }])}>Add item</Button>} padding={false}>
        <div className="quote-table-wrap !border-0 !rounded-none">
          <table className="quote-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Description</th>
                <th style={{ width: 110 }}>Brand</th>
                <th style={{ width: 80 }}>Unit</th>
                <th style={{ width: 80 }}>Qty</th>
                <th style={{ width: 120 }}>Est. unit cost</th>
                <th style={{ width: 110 }}>Line total</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx}>
                  <td className="text-center text-xs text-[var(--text-muted)]">{idx + 1}</td>
                  <td><input className="quote-form-input !py-1" value={it.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Item description" /></td>
                  <td><input className="quote-form-input !py-1" value={it.brand} onChange={e => updateItem(idx, 'brand', e.target.value)} /></td>
                  <td><input className="quote-form-input !py-1" value={it.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} /></td>
                  <td><input type="number" className="quote-form-input !py-1 text-right" value={it.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} /></td>
                  <td><input type="number" className="quote-form-input !py-1 text-right" value={it.estimated_unit_cost} onChange={e => updateItem(idx, 'estimated_unit_cost', Number(e.target.value))} /></td>
                  <td className="text-right font-mono text-xs">{((Number(it.quantity) || 0) * (Number(it.estimated_unit_cost) || 0)).toFixed(2)}</td>
                  <td className="text-center">
                    <button className="text-[var(--text-muted)] hover:text-[var(--error)] cursor-pointer" onClick={() => setItems(p => p.filter((_, i) => i !== idx))} disabled={items.length === 1}><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end px-4 py-3 border-t border-[var(--border-color)]">
          <span className="text-sm">Estimated total: <strong className="font-mono">{new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2 }).format(estTotal)} AED</strong></span>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="md" icon={Save} isLoading={saving} onClick={() => handleSave(false)}>Save draft</Button>
        <Button variant="primary" size="md" isLoading={saving} onClick={() => handleSave(true)}>Save & submit for approval</Button>
      </div>
    </div>
  );
}
