'use client';

// ============================================================
// JEET ERP — Form Designer
// Tabs → sections → fields with a field palette, property
// editor and live preview. Saves the schema as jsonb.
// ============================================================

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import formBuilderService from '@/services/formBuilderService';
import type { FormDefinition, FormSchema, FormTab, FormSection, FormFieldDef, FormFieldType } from '@/types/platform.types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Plus, Trash2, X, Save, ChevronUp, ChevronDown, Eye } from 'lucide-react';

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Text area' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency (AED)' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi-select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'radio', label: 'Radio group' },
  { value: 'file', label: 'File upload' },
  { value: 'image', label: 'Image' },
  { value: 'signature', label: 'Signature' },
  { value: 'table', label: 'Table / grid' },
  { value: 'richtext', label: 'Rich text' },
];

const uid = () => Math.random().toString(36).slice(2, 9);

export default function FormDesignerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [def, setDef] = useState<FormDefinition | null>(null);
  const [schema, setSchema] = useState<FormSchema>({ tabs: [] });
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldModal, setFieldModal] = useState<{ sectionId: string; field: FormFieldDef } | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await formBuilderService.getDefinition(id);
      setDef(d);
      setSchema(d.schema?.tabs ? d.schema : { tabs: [] });
    } catch (err: any) {
      setError(err.message || 'Failed to load form');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const mutate = (fn: (s: FormSchema) => FormSchema) => {
    setSchema(prev => fn(structuredClone(prev)));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await formBuilderService.updateSchema(id, schema);
      setDirty(false);
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ---------- Tab/section/field ops ----------
  const addTab = () => mutate(s => {
    s.tabs.push({ id: `tab-${uid()}`, label: `Tab ${s.tabs.length + 1}`, sections: [] });
    return s;
  });

  const addSection = (tabIdx: number) => mutate(s => {
    s.tabs[tabIdx].sections.push({ id: `sec-${uid()}`, label: 'New section', columns: 2, fields: [] });
    return s;
  });

  const addField = (sectionId: string) => {
    setFieldModal({
      sectionId,
      field: { id: `fld-${uid()}`, key: '', label: '', type: 'text', required: false },
    });
  };

  const saveField = () => {
    if (!fieldModal?.field.label) return;
    const f = { ...fieldModal.field, key: fieldModal.field.key || fieldModal.field.label.toLowerCase().replace(/\s+/g, '_') };
    mutate(s => {
      for (const tab of s.tabs) {
        for (const sec of tab.sections) {
          if (sec.id !== fieldModal.sectionId) continue;
          const idx = sec.fields.findIndex(x => x.id === f.id);
          if (idx >= 0) sec.fields[idx] = f;
          else sec.fields.push(f);
        }
      }
      return s;
    });
    setFieldModal(null);
  };

  const moveField = (sectionId: string, fieldIdx: number, dir: -1 | 1) => mutate(s => {
    for (const tab of s.tabs) {
      for (const sec of tab.sections) {
        if (sec.id !== sectionId) continue;
        const tgt = fieldIdx + dir;
        if (tgt < 0 || tgt >= sec.fields.length) return s;
        [sec.fields[fieldIdx], sec.fields[tgt]] = [sec.fields[tgt], sec.fields[fieldIdx]];
      }
    }
    return s;
  });

  // ---------- Preview rendering ----------
  const renderPreviewField = (f: FormFieldDef) => {
    const base = 'quote-form-input';
    switch (f.type) {
      case 'textarea': case 'richtext':
        return <textarea className="quote-form-textarea" placeholder={f.placeholder} disabled rows={2} />;
      case 'dropdown': case 'multiselect':
        return (
          <select className={base} disabled multiple={f.type === 'multiselect'}>
            {(f.options || []).map(o => <option key={o.value}>{o.label}</option>)}
          </select>
        );
      case 'checkbox':
        return <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]"><input type="checkbox" disabled /> {f.label}</label>;
      case 'radio':
        return (
          <div className="flex gap-3">
            {(f.options || [{ value: '1', label: 'Option 1' }]).map(o => (
              <label key={o.value} className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <input type="radio" disabled /> {o.label}
              </label>
            ))}
          </div>
        );
      case 'file': case 'image':
        return <div className="border border-dashed border-[var(--border-color)] rounded-md p-3 text-center text-xs text-[var(--text-muted)]">Upload {f.type}</div>;
      case 'signature':
        return <div className="border border-dashed border-[var(--border-color)] rounded-md h-16 flex items-center justify-center text-xs text-[var(--text-muted)]">Signature pad</div>;
      case 'table':
        return <div className="border border-[var(--border-color)] rounded-md p-3 text-center text-xs text-[var(--text-muted)]">Table / grid</div>;
      case 'date':
        return <input type="date" className={base} disabled />;
      case 'time':
        return <input type="time" className={base} disabled />;
      case 'number': case 'currency':
        return <input type="number" className={base} placeholder={f.type === 'currency' ? '0.00 AED' : f.placeholder} disabled />;
      default:
        return <input className={base} placeholder={f.placeholder} disabled />;
    }
  };

  if (loading) return <div className="py-24 flex justify-center"><div className="h-7 w-7 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin rounded-full" /></div>;
  if (!def) return <div className="py-24 text-center text-sm text-[var(--text-muted)]">{error || 'Form not found'}</div>;

  const activeTab: FormTab | undefined = schema.tabs[activeTabIdx];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={def.name}
        referenceId={def.module_key}
        status={def.is_active ? 'ACTIVE' : 'DRAFT'}
        subtitle="Design the form layout — changes apply to the module as soon as you save and activate"
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Forms', href: '/admin/forms' }, { label: def.name }]}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" icon={Eye} onClick={() => setShowPreview(p => !p)}>
              {showPreview ? 'Hide preview' : 'Show preview'}
            </Button>
            <Button size="sm" variant="primary" icon={Save} isLoading={saving} disabled={!dirty} onClick={save}>
              {dirty ? 'Save changes' : 'Saved'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => router.push('/admin/forms')}>Back</Button>
          </div>
        }
      />

      {error && (
        <div className="flex items-center justify-between gap-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg p-3 text-xs text-[var(--status-danger-text)]">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="cursor-pointer"><X size={13} /></button>
        </div>
      )}

      <div className={`grid grid-cols-1 ${showPreview ? 'xl:grid-cols-2' : ''} gap-4 items-start`}>
        {/* ---------- Structure editor ---------- */}
        <Card title="Structure" subtitle="Tabs → sections → fields" padding={false}>
          {/* Tab bar */}
          <div className="flex items-center gap-1 border-b border-[var(--border-color)] px-3 pt-2 overflow-x-auto">
            {schema.tabs.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setActiveTabIdx(i)}
                className={`px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
                  i === activeTabIdx
                    ? 'text-[var(--text-primary)] border-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]'
                }`}
              >
                {t.label}
              </button>
            ))}
            <button onClick={addTab} className="px-2 py-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer" title="Add tab">
              <Plus size={14} />
            </button>
          </div>

          {activeTab ? (
            <div className="p-4 flex flex-col gap-4">
              {/* Tab meta */}
              <div className="flex gap-2 items-center">
                <input
                  className="quote-form-input max-w-[220px]"
                  value={activeTab.label}
                  onChange={e => mutate(s => { s.tabs[activeTabIdx].label = e.target.value; return s; })}
                />
                <Button size="sm" variant="muted" icon={Trash2}
                  onClick={() => {
                    if (!window.confirm(`Delete tab "${activeTab.label}" and its fields?`)) return;
                    mutate(s => { s.tabs.splice(activeTabIdx, 1); return s; });
                    setActiveTabIdx(0);
                  }}>
                  Delete tab
                </Button>
              </div>

              {/* Sections */}
              {activeTab.sections.map((sec: FormSection, secIdx: number) => (
                <div key={sec.id} className="border border-[var(--border-color)] rounded-lg">
                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-card-hover)] rounded-t-lg">
                    <input
                      className="bg-transparent text-xs font-medium text-[var(--text-primary)] outline-none flex-1"
                      value={sec.label}
                      onChange={e => mutate(s => { s.tabs[activeTabIdx].sections[secIdx].label = e.target.value; return s; })}
                    />
                    <select
                      className="quote-form-input !w-28 !py-1 !text-xs"
                      value={sec.columns}
                      onChange={e => mutate(s => { s.tabs[activeTabIdx].sections[secIdx].columns = Number(e.target.value); return s; })}
                    >
                      <option value={1}>1 column</option>
                      <option value={2}>2 columns</option>
                      <option value={3}>3 columns</option>
                    </select>
                    <button className="text-[var(--text-muted)] hover:text-[var(--error)] cursor-pointer"
                      onClick={() => {
                        if (!window.confirm(`Delete section "${sec.label}"?`)) return;
                        mutate(s => { s.tabs[activeTabIdx].sections.splice(secIdx, 1); return s; });
                      }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="p-2 flex flex-col gap-1">
                    {sec.fields.map((f, fIdx) => (
                      <div key={f.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md hover:bg-[var(--bg-card-hover)] group">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-medium text-[var(--text-primary)] truncate">{f.label}</span>
                          <span className="text-[0.6875rem] text-[var(--text-muted)] font-mono">{f.type}</span>
                          {f.required && <span className="text-[0.6875rem] text-[var(--error)]">*</span>}
                          {f.conditional?.field && <span className="text-[0.6875rem] text-[var(--text-muted)]">⚡if {f.conditional.field}</span>}
                        </div>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer" onClick={() => moveField(sec.id, fIdx, -1)}><ChevronUp size={12} /></button>
                          <button className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer" onClick={() => moveField(sec.id, fIdx, 1)}><ChevronDown size={12} /></button>
                          <button className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer" onClick={() => setFieldModal({ sectionId: sec.id, field: { ...f } })}>Edit</button>
                          <button className="p-1 text-[var(--text-muted)] hover:text-[var(--error)] cursor-pointer"
                            onClick={() => mutate(s => {
                              const section = s.tabs[activeTabIdx].sections[secIdx];
                              section.fields = section.fields.filter(x => x.id !== f.id);
                              return s;
                            })}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <Button size="sm" variant="muted" icon={Plus} onClick={() => addField(sec.id)} className="self-start">Add field</Button>
                  </div>
                </div>
              ))}

              <Button size="sm" variant="secondary" icon={Plus} onClick={() => addSection(activeTabIdx)} className="self-start">Add section</Button>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-[var(--text-muted)]">No tabs — add one to begin.</div>
          )}
        </Card>

        {/* ---------- Live preview ---------- */}
        {showPreview && (
          <Card title="Live preview" subtitle="How the form renders in the module">
            {activeTab ? (
              <div className="flex flex-col gap-5">
                {activeTab.sections.map(sec => (
                  <div key={sec.id} className="flex flex-col gap-3">
                    <h4 className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border-color)] pb-1.5">{sec.label}</h4>
                    <div className={`grid gap-3 ${sec.columns === 1 ? 'grid-cols-1' : sec.columns === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                      {sec.fields.filter(f => !f.hidden).map(f => (
                        <div key={f.id} className={`quote-form-group ${f.type === 'textarea' || f.type === 'table' || f.type === 'richtext' ? 'col-span-full' : ''}`}>
                          {f.type !== 'checkbox' && (
                            <label>{f.label} {f.required && <span className="text-[var(--error)]">*</span>}</label>
                          )}
                          {renderPreviewField(f)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {activeTab.sections.length === 0 && <p className="text-xs text-[var(--text-muted)] py-8 text-center">Empty tab.</p>}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)] py-8 text-center">Nothing to preview.</p>
            )}
          </Card>
        )}
      </div>

      {/* ---------- Field modal ---------- */}
      {fieldModal && (
        <div className="quote-modal-overlay" onClick={() => setFieldModal(null)}>
          <div className="quote-modal" onClick={e => e.stopPropagation()}>
            <div className="quote-modal-header">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Field properties</h3>
              <button onClick={() => setFieldModal(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"><X size={16} /></button>
            </div>
            <div className="quote-modal-body flex flex-col gap-4">
              <div className="quote-form-grid">
                <div className="quote-form-group">
                  <label>Label</label>
                  <input className="quote-form-input" value={fieldModal.field.label}
                    onChange={e => setFieldModal({ ...fieldModal, field: { ...fieldModal.field, label: e.target.value } })} />
                </div>
                <div className="quote-form-group">
                  <label>Field key (auto if blank)</label>
                  <input className="quote-form-input font-mono" value={fieldModal.field.key}
                    onChange={e => setFieldModal({ ...fieldModal, field: { ...fieldModal.field, key: e.target.value } })} />
                </div>
                <div className="quote-form-group">
                  <label>Type</label>
                  <select className="quote-form-input" value={fieldModal.field.type}
                    onChange={e => setFieldModal({ ...fieldModal, field: { ...fieldModal.field, type: e.target.value as FormFieldType } })}>
                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="quote-form-group">
                  <label>Placeholder</label>
                  <input className="quote-form-input" value={fieldModal.field.placeholder || ''}
                    onChange={e => setFieldModal({ ...fieldModal, field: { ...fieldModal.field, placeholder: e.target.value } })} />
                </div>
              </div>

              {(fieldModal.field.type === 'dropdown' || fieldModal.field.type === 'multiselect' || fieldModal.field.type === 'radio') && (
                <div className="quote-form-group">
                  <label>Options (one per line, value|label)</label>
                  <textarea
                    className="quote-form-textarea font-mono"
                    rows={4}
                    value={(fieldModal.field.options || []).map(o => `${o.value}|${o.label}`).join('\n')}
                    onChange={e => setFieldModal({
                      ...fieldModal,
                      field: {
                        ...fieldModal.field,
                        options: e.target.value.split('\n').filter(Boolean).map(line => {
                          const [value, label] = line.split('|');
                          return { value: value?.trim() || '', label: (label || value)?.trim() || '' };
                        }),
                      },
                    })}
                    placeholder={'critical|Critical\nhigh|High\nnormal|Normal'}
                  />
                </div>
              )}

              <div className="flex gap-5 flex-wrap">
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                  <input type="checkbox" checked={!!fieldModal.field.required}
                    onChange={e => setFieldModal({ ...fieldModal, field: { ...fieldModal.field, required: e.target.checked } })} />
                  Required
                </label>
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                  <input type="checkbox" checked={!!fieldModal.field.readonly}
                    onChange={e => setFieldModal({ ...fieldModal, field: { ...fieldModal.field, readonly: e.target.checked } })} />
                  Read-only
                </label>
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                  <input type="checkbox" checked={!!fieldModal.field.hidden}
                    onChange={e => setFieldModal({ ...fieldModal, field: { ...fieldModal.field, hidden: e.target.checked } })} />
                  Hidden
                </label>
              </div>

              <div className="quote-form-group">
                <label>Conditional visibility (optional)</label>
                <div className="flex gap-2">
                  <input className="quote-form-input flex-1" placeholder="when field…"
                    value={fieldModal.field.conditional?.field || ''}
                    onChange={e => setFieldModal({
                      ...fieldModal,
                      field: { ...fieldModal.field, conditional: e.target.value ? { field: e.target.value, operator: fieldModal.field.conditional?.operator || '=', value: fieldModal.field.conditional?.value } : undefined },
                    })} />
                  <select className="quote-form-input !w-28"
                    value={fieldModal.field.conditional?.operator || '='}
                    onChange={e => fieldModal.field.conditional && setFieldModal({
                      ...fieldModal,
                      field: { ...fieldModal.field, conditional: { ...fieldModal.field.conditional, operator: e.target.value as any } },
                    })}>
                    {['=', '!=', '>', '<', 'not_empty', 'is_empty'].map(op => <option key={op} value={op}>{op}</option>)}
                  </select>
                  <input className="quote-form-input flex-1" placeholder="equals value…"
                    value={String(fieldModal.field.conditional?.value ?? '')}
                    onChange={e => fieldModal.field.conditional && setFieldModal({
                      ...fieldModal,
                      field: { ...fieldModal.field, conditional: { ...fieldModal.field.conditional, value: e.target.value } },
                    })} />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setFieldModal(null)}>Cancel</Button>
                <Button variant="primary" size="sm" icon={Save} onClick={saveField}>Apply field</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
