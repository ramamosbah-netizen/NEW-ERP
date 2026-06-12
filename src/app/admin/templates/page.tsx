'use client';

// ============================================================
// JEET ERP — Document Template Builder
// Templates with header/footer/watermark/signatures and
// {{variable}} placeholders, with live preview + test print.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import templateService, { DEFAULT_TEMPLATE_CONTENT } from '@/services/templateService';
import { MODULE_CATALOG } from '@/types/platform.types';
import type { DocumentTemplate, TemplateContent } from '@/types/platform.types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileText, Plus, Save, Trash2, X, Copy, Printer } from 'lucide-react';

const SUGGESTED_KEYS = [
  'MAR', 'MIR', 'LPO', 'RFQ', 'QTN', 'INV', 'DELIVERY_NOTE', 'PR',
  'HANDOVER', 'INSPECTION_CHECKLIST', 'TENDER_EVAL', 'MOM',
  'TECHNICAL_REPORT', 'SERVICE_REPORT', 'ASSET_HANDOVER', 'MAINTENANCE_REPORT',
  'TC_REPORT', 'SNAG_REPORT', 'WORK_COMPLETION', 'NCR', 'PTW',
];

const SAMPLE_VARS: Record<string, string> = {
  DocumentTitle: 'Material Approval Request',
  DocumentNo: 'MAR-2026-0042',
  Date: new Date().toLocaleDateString('en-AE'),
  ProjectName: 'Marina Tower MEP Fit-out',
  ClientName: 'Emaar Properties',
  PreparedBy: 'Mosbah Rama',
  CompanyName: 'JEET Contracting LLC',
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DocumentTemplate | null>(null);
  const [content, setContent] = useState<TemplateContent>(DEFAULT_TEMPLATE_CONTENT);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState('MAR');
  const [customKey, setCustomKey] = useState('');
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setTemplates(await templateService.getTemplates());
      setError(null);
    } catch (err: any) {
      setError(err.message?.includes('relation')
        ? 'Template tables not found — apply the platform migration first (see Admin Center).'
        : err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live preview refresh
  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    const tpl = { ...editing, content };
    templateService.renderToHtml(tpl, SAMPLE_VARS)
      .then(html => { if (!cancelled) setPreviewHtml(html); })
      .catch(() => { /* preview best-effort */ });
    return () => { cancelled = true; };
  }, [editing, content]);

  const openEditor = (tpl: DocumentTemplate) => {
    setEditing(tpl);
    setContent({ ...DEFAULT_TEMPLATE_CONTENT, ...(tpl.content || {}) });
  };

  const saveTemplate = async () => {
    if (!editing) return;
    setBusy('save');
    try {
      await templateService.updateTemplate(editing.id, { content });
      await load();
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setBusy(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = newKey === '__CUSTOM__' ? customKey.trim().toUpperCase().replace(/\s+/g, '_') : newKey;
    if (!key || !newName.trim()) return;
    setBusy('create');
    try {
      const tpl = await templateService.createTemplate({ template_key: key, name: newName.trim() });
      setShowCreate(false);
      setNewName(''); setCustomKey('');
      await load();
      openEditor(tpl);
    } catch (err: any) {
      setError(err.message || 'Create failed');
    } finally {
      setBusy(null);
    }
  };

  const testPrint = async () => {
    if (!editing) return;
    const html = await templateService.renderToHtml({ ...editing, content }, SAMPLE_VARS);
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Document Templates"
        subtitle="Print-ready templates for MAR, MIR, LPO, RFQ, invoices, handovers and all ELV/MEP documents — with live variables"
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Templates' }]}
        actions={<Button variant="primary" size="sm" icon={Plus} onClick={() => setShowCreate(true)}>New template</Button>}
      />

      {error && (
        <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button>
        </div>
      )}

      {loading ? (
        <div className="py-24 flex justify-center"><div className="h-7 w-7 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin rounded-full" /></div>
      ) : !editing ? (
        templates.length === 0 ? (
          <EmptyState icon={FileText} title="No templates" description="Create document templates with headers, footers, watermarks and variables." actionText="Create template" onAction={() => setShowCreate(true)} />
        ) : (
          <Card padding={false}>
            <div className="divide-y divide-[var(--border-color)]">
              {templates.map(tpl => (
                <div key={tpl.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--bg-card-hover)]">
                  <div className="min-w-0 flex items-center gap-3">
                    <FileText size={15} className="text-[var(--text-muted)] flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditor(tpl)} className="text-sm font-medium text-[var(--text-primary)] hover:underline cursor-pointer">{tpl.name}</button>
                        <span className="font-mono text-xs text-[var(--text-muted)]">{tpl.template_key}</span>
                        {tpl.is_active && <span className="q-badge q-badge-approved">Active</span>}
                      </div>
                      {tpl.description && <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{tpl.description}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Button size="sm" variant="muted" onClick={() => openEditor(tpl)}>Edit</Button>
                    <Button size="sm" variant="muted" icon={Copy} disabled={busy !== null}
                      onClick={async () => { setBusy(tpl.id); try { await templateService.cloneTemplate(tpl.id); await load(); } finally { setBusy(null); } }}>
                      Clone
                    </Button>
                    <Button size="sm" variant="muted" icon={Trash2} disabled={busy !== null}
                      onClick={async () => {
                        if (!window.confirm(`Delete template "${tpl.name}"?`)) return;
                        setBusy(tpl.id);
                        try { await templateService.deleteTemplate(tpl.id); await load(); } finally { setBusy(null); }
                      }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )
      ) : (
        /* ---------- Editor + live preview ---------- */
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">{editing.name}</span>
              <span className="font-mono text-xs text-[var(--text-muted)]">{editing.template_key}</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" icon={Printer} onClick={testPrint}>Test print</Button>
              <Button size="sm" variant="primary" icon={Save} isLoading={busy === 'save'} onClick={saveTemplate}>Save template</Button>
              <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>Back to list</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
            <div className="flex flex-col gap-4">
              {/* Header */}
              <Card title="Header">
                <div className="flex flex-col gap-3">
                  <div className="quote-form-grid">
                    <div className="quote-form-group">
                      <label>Title</label>
                      <input className="quote-form-input" value={content.header.title}
                        onChange={e => setContent({ ...content, header: { ...content.header, title: e.target.value } })}
                        placeholder="{{CompanyName}} or static text" />
                    </div>
                    <div className="quote-form-group">
                      <label>Subtitle</label>
                      <input className="quote-form-input" value={content.header.subtitle}
                        onChange={e => setContent({ ...content, header: { ...content.header, subtitle: e.target.value } })} />
                    </div>
                  </div>
                  <div className="flex gap-5">
                    <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                      <input type="checkbox" checked={content.header.show_logo}
                        onChange={e => setContent({ ...content, header: { ...content.header, show_logo: e.target.checked } })} />
                      Company logo
                    </label>
                    <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                      <input type="checkbox" checked={content.header.show_qr}
                        onChange={e => setContent({ ...content, header: { ...content.header, show_qr: e.target.checked } })} />
                      QR code placeholder
                    </label>
                  </div>
                </div>
              </Card>

              {/* Body */}
              <Card title="Body (HTML with {{variables}})" subtitle={`Available: ${Object.keys(SAMPLE_VARS).join(', ')}`}>
                <textarea
                  className="quote-form-textarea font-mono !text-xs"
                  rows={12}
                  value={content.body_html}
                  onChange={e => setContent({ ...content, body_html: e.target.value })}
                />
              </Card>

              {/* Footer / watermark / signatures */}
              <Card title="Footer, watermark & signatures">
                <div className="flex flex-col gap-4">
                  <div className="quote-form-group">
                    <label>Footer text</label>
                    <input className="quote-form-input" value={content.footer.text}
                      onChange={e => setContent({ ...content, footer: { ...content.footer, text: e.target.value } })}
                      placeholder="{{CompanyName}} | TRN: {{CompanyTRN}}" />
                  </div>
                  <div className="flex gap-5 flex-wrap">
                    <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                      <input type="checkbox" checked={content.footer.show_page_numbers}
                        onChange={e => setContent({ ...content, footer: { ...content.footer, show_page_numbers: e.target.checked } })} />
                      Page numbers
                    </label>
                    <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                      <input type="checkbox" checked={content.watermark.enabled}
                        onChange={e => setContent({ ...content, watermark: { ...content.watermark, enabled: e.target.checked } })} />
                      Watermark
                    </label>
                    {content.watermark.enabled && (
                      <input className="quote-form-input !w-40" value={content.watermark.text}
                        onChange={e => setContent({ ...content, watermark: { ...content.watermark, text: e.target.value } })}
                        placeholder="DRAFT" />
                    )}
                  </div>
                  <div className="quote-form-group">
                    <label>Signature blocks (one per line)</label>
                    <textarea
                      className="quote-form-textarea"
                      rows={3}
                      value={content.signature_blocks.map(b => b.label).join('\n')}
                      onChange={e => setContent({
                        ...content,
                        signature_blocks: e.target.value.split('\n').filter(Boolean).map(label => ({ label })),
                      })}
                    />
                  </div>
                </div>
              </Card>
            </div>

            {/* Preview */}
            <Card title="Live preview" subtitle="Rendered with sample data" padding={false}>
              <iframe
                title="template-preview"
                srcDoc={previewHtml}
                className="w-full bg-white rounded-b-lg"
                style={{ height: 760, border: 'none' }}
              />
            </Card>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="quote-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="quote-modal" onClick={e => e.stopPropagation()}>
            <div className="quote-modal-header">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">New document template</h3>
              <button onClick={() => setShowCreate(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreate} className="quote-modal-body flex flex-col gap-4">
              <div className="quote-form-group">
                <label>Template type</label>
                <select className="quote-form-input" value={newKey} onChange={e => setNewKey(e.target.value)}>
                  {SUGGESTED_KEYS.filter(k => !templates.some(t => t.template_key === k)).map(k => (
                    <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>
                  ))}
                  <option value="__CUSTOM__">Custom key…</option>
                </select>
              </div>
              {newKey === '__CUSTOM__' && (
                <div className="quote-form-group">
                  <label>Custom template key</label>
                  <input className="quote-form-input font-mono" value={customKey} onChange={e => setCustomKey(e.target.value)} placeholder="e.g. CABLE_TEST_REPORT" />
                </div>
              )}
              <div className="quote-form-group">
                <label>Template name</label>
                <input className="quote-form-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Material Approval Request" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button variant="primary" size="sm" type="submit" isLoading={busy === 'create'}>Create & edit</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
