'use client';

// ============================================================
// JEET ERP — Request for Quotation builder (from a BOQ)
// Items prefilled from the BOQ and fully editable, suppliers/
// subcontractors multi-selected, cover message + quote-by date.
// Records the RFQ to the log, exports a PDF, and opens a pre-filled
// email (BCC to keep recipients private) ready to send.
// ============================================================

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import rfqService, { RFQItem, RFQSupplier, RFQ } from '@/services/rfqService';
import rfqPDFService from '@/lib/rfq-pdf';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Plus, Trash2, Mail, Download, Save, Search, X, Send, Users } from 'lucide-react';

const TYPE_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  SUPPLIER: { label: 'Supplier', bg: 'var(--status-info-bg)', text: 'var(--status-info-text)' },
  SUBCONTRACTOR: { label: 'Subcontractor', bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)' },
  BOTH: { label: 'Both', bg: 'var(--status-success-bg)', text: 'var(--status-success-text)' },
};

export default function RFQBuilderPage({ params }: { params: Promise<{ boqId: string }> }) {
  const { boqId } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [tenderId, setTenderId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState<string | null>(null);
  const [items, setItems] = useState<RFQItem[]>([]);
  const [recipients, setRecipients] = useState<RFQSupplier[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [supplierSearch, setSupplierSearch] = useState('');

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState(
    'Dear Sir/Madam,\n\nPlease provide your best quotation for the items listed below. Kindly include unit prices, lead time, warranty and validity of the offer.\n\nWe look forward to your competitive offer.'
  );
  const [dueDate, setDueDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ tenderId, projectTitle, items }, recips] = await Promise.all([
        rfqService.getBoqItems(boqId),
        rfqService.getRecipients(),
      ]);
      setTenderId(tenderId);
      setProjectTitle(projectTitle);
      setItems(items);
      setRecipients(recips);
      setSubject(projectTitle ? `Request for Quotation — ${projectTitle}` : 'Request for Quotation');
    } catch (err: any) {
      setError(err.message || 'Failed to load BOQ');
    } finally {
      setLoading(false);
    }
  }, [boqId]);
  useEffect(() => { load(); }, [load]);

  // ---- item editing ----
  const updateItem = (i: number, patch: Partial<RFQItem>) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const addItem = () => setItems(prev => [...prev, { item_code: '', description: '', unit: 'Pcs', quantity: 1 }]);

  // ---- supplier selection ----
  const toggle = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectedSuppliers = (): RFQSupplier[] => recipients.filter(r => selected.has(r.id));

  const filteredRecipients = recipients.filter(r =>
    !supplierSearch ||
    r.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    (r.email || '').toLowerCase().includes(supplierSearch.toLowerCase())
  );

  const validate = (): string | null => {
    if (!subject.trim()) return 'Add a subject.';
    const valid = items.filter(it => it.description.trim() && it.quantity > 0);
    if (valid.length === 0) return 'Add at least one item with a description and quantity.';
    if (selected.size === 0) return 'Select at least one supplier or subcontractor.';
    return null;
  };

  const buildRFQObject = (rfq_number: string, status: RFQ['status']): RFQ => ({
    id: 'preview', rfq_number, tender_id: tenderId, boq_id: boqId,
    project_title: projectTitle, subject, message, due_date: dueDate || null,
    items: items.filter(it => it.description.trim()),
    suppliers: selectedSuppliers(), status,
    created_by: null, sent_at: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });

  const persist = async (status: RFQ['status']): Promise<RFQ> => {
    return rfqService.create({
      tender_id: tenderId, boq_id: boqId, project_title: projectTitle,
      subject: subject.trim(), message, due_date: dueDate || null,
      items: items.filter(it => it.description.trim() && it.quantity > 0),
      suppliers: selectedSuppliers(), status,
    });
  };

  const openMail = (rfq: RFQ) => {
    const emails = rfq.suppliers.map(s => s.email).filter(Boolean) as string[];
    const lines: string[] = [];
    lines.push(message || '');
    lines.push('');
    if (projectTitle) lines.push(`Project: ${projectTitle}`);
    lines.push(`RFQ Ref: ${rfq.rfq_number}`);
    if (dueDate) lines.push(`Please submit your quote by: ${dueDate}`);
    lines.push('');
    lines.push('Items:');
    rfq.items.forEach((it, i) =>
      lines.push(`${i + 1}. ${it.description}${it.item_code ? ` [${it.item_code}]` : ''} — ${it.quantity} ${it.unit}`));
    lines.push('');
    lines.push('A detailed RFQ document (PDF) is attached for your pricing.');
    lines.push('');
    lines.push('Regards,');
    lines.push('JEET INTECH L.L.C');
    const href = `mailto:?bcc=${encodeURIComponent(emails.join(','))}` +
      `&subject=${encodeURIComponent(subject.trim())}` +
      `&body=${encodeURIComponent(lines.join('\r\n'))}`;
    window.location.href = href;
  };

  const handleDownloadPDF = () => {
    const err = validate();
    if (err) { setError(err); return; }
    rfqPDFService.download(buildRFQObject('DRAFT-PREVIEW', 'DRAFT'));
  };

  const handleSaveDraft = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    try { await persist('DRAFT'); router.push('/procurement/rfq'); }
    catch (err: any) { setError(err.message || 'Failed to save'); setSaving(false); }
  };

  const handleSaveAndMail = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    try {
      const rfq = await persist('SENT');
      rfqPDFService.download(rfq);   // so the user can attach it
      openMail(rfq);
      router.push('/procurement/rfq');
    } catch (err: any) { setError(err.message || 'Failed to save'); setSaving(false); }
  };

  if (loading) return <div className="p-8 text-sm text-[var(--text-tertiary)]">Loading BOQ…</div>;

  return (
    <div className="flex flex-col gap-5 pb-24">
      <PageHeader
        title="Request for Quotation"
        subtitle={projectTitle ? `Sourcing for ${projectTitle}` : 'Draft a quotation request from this BOQ'}
        breadcrumbs={[{ label: 'Procurement', href: '/procurement/po' }, { label: 'RFQ', href: '/procurement/rfq' }, { label: 'New' }]}
        actions={<Button size="sm" variant="secondary" onClick={() => router.back()}>Cancel</Button>}
      />

      {error && (
        <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button>
        </div>
      )}

      {/* Request meta */}
      <Card className="p-4 flex flex-col gap-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)]">Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full mt-1 px-3 h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)]">Quote by (due date)</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full mt-1 px-3 h-10 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--text-secondary)]">Cover message / terms</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
            className="w-full mt-1 px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--surface)] text-sm leading-relaxed" />
        </div>
      </Card>

      {/* Items */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div className="text-sm font-semibold text-[var(--text-primary)]">Items ({items.length})</div>
          <Button size="sm" variant="secondary" onClick={addItem}><Plus size={13} /> Add row</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--text-tertiary)]">
                <th className="px-3 py-2 font-medium w-10">#</th>
                <th className="px-3 py-2 font-medium w-28">Code</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium w-20">Unit</th>
                <th className="px-3 py-2 font-medium w-24">Qty</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-3 py-1.5 text-[var(--text-tertiary)]">{i + 1}</td>
                  <td className="px-3 py-1.5">
                    <input value={it.item_code || ''} onChange={e => updateItem(i, { item_code: e.target.value })}
                      className="w-full px-2 h-8 rounded border border-[var(--border)] bg-[var(--surface)]" />
                  </td>
                  <td className="px-3 py-1.5">
                    <input value={it.description} onChange={e => updateItem(i, { description: e.target.value })}
                      className="w-full px-2 h-8 rounded border border-[var(--border)] bg-[var(--surface)]" />
                  </td>
                  <td className="px-3 py-1.5">
                    <input value={it.unit} onChange={e => updateItem(i, { unit: e.target.value })}
                      className="w-full px-2 h-8 rounded border border-[var(--border)] bg-[var(--surface)]" />
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="number" min={0} value={it.quantity}
                      onChange={e => updateItem(i, { quantity: Number(e.target.value) })}
                      className="w-full px-2 h-8 rounded border border-[var(--border)] bg-[var(--surface)] text-right" />
                  </td>
                  <td className="px-3 py-1.5">
                    <button onClick={() => removeItem(i)} className="text-[var(--text-tertiary)] hover:text-[var(--status-danger-text)] cursor-pointer"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-[var(--text-tertiary)]">No items — add a row.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Suppliers */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
            <Users size={14} /> Send to ({selected.size} selected)
          </div>
          <div className="relative w-56">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)} placeholder="Search suppliers…"
              className="w-full pl-8 pr-3 h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] text-xs" />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-[var(--border)]">
          {filteredRecipients.map(r => {
            const badge = TYPE_BADGE[r.type] || TYPE_BADGE.SUPPLIER;
            const noEmail = !r.email;
            return (
              <label key={r.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--surface-hover)]">
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="w-4 h-4" />
                <span className="text-sm text-[var(--text-primary)] font-medium flex-1">{r.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.text }}>{badge.label}</span>
                <span className={`text-xs ${noEmail ? 'text-[var(--status-warning-text)]' : 'text-[var(--text-tertiary)]'}`}>
                  {r.email || 'no email on file'}
                </span>
              </label>
            );
          })}
          {filteredRecipients.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-[var(--text-tertiary)]">No suppliers found.</div>
          )}
        </div>
      </Card>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[var(--surface)] border-t border-[var(--border)] px-6 py-3 flex items-center justify-end gap-2 z-10">
        <Button variant="secondary" size="sm" onClick={handleDownloadPDF}><Download size={14} /> Download PDF</Button>
        <Button variant="secondary" size="sm" onClick={handleSaveDraft} isLoading={saving}><Save size={14} /> Save draft</Button>
        <Button variant="primary" size="sm" onClick={handleSaveAndMail} isLoading={saving}><Send size={14} /> Save & open mail</Button>
      </div>
    </div>
  );
}
