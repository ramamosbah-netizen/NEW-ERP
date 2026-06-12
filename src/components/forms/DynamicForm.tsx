'use client';

// ============================================================
// JEET ERP — DynamicForm
// Renders the admin-configured form schema for a module.
// Handles all field types, conditional visibility, validation
// and submission. Modules use it like:
//
//   <DynamicForm moduleKey="MAR"
//                initialValues={record}
//                onSubmit={async (values) => save(values)} />
//
// Renders nothing (returns null and calls onNoForm) when no
// active form is configured, so callers can fall back to
// their built-in form.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import formBuilderService from '@/services/formBuilderService';
import type { FormDefinition, FormFieldDef, FormSchema } from '@/types/platform.types';
import { Button } from '@/components/ui/Button';
import { Save } from 'lucide-react';

interface DynamicFormProps {
  moduleKey: string;
  initialValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => Promise<void> | void;
  /** Called when no active form exists for the module. */
  onNoForm?: () => void;
  submitLabel?: string;
  readOnly?: boolean;
  className?: string;
}

export const DynamicForm: React.FC<DynamicFormProps> = ({
  moduleKey,
  initialValues = {},
  onSubmit,
  onNoForm,
  submitLabel = 'Save',
  readOnly = false,
  className = '',
}) => {
  const [def, setDef] = useState<FormDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    formBuilderService.getActiveForm(moduleKey)
      .then(d => {
        if (cancelled) return;
        setDef(d);
        if (!d) onNoForm?.();
        // Apply defaults for fields without an initial value
        if (d) {
          const defaults: Record<string, unknown> = {};
          for (const f of formBuilderService.flattenFields(d.schema)) {
            if (f.default_value !== undefined && initialValues[f.key] === undefined) {
              defaults[f.key] = f.default_value;
            }
          }
          setValues(v => ({ ...defaults, ...v }));
        }
      })
      .catch(() => { if (!cancelled) { setDef(null); onNoForm?.(); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey]);

  const setValue = useCallback((key: string, value: unknown) => {
    setValues(v => ({ ...v, [key]: value }));
    setErrors(e => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!def) return;
    const validationErrors = formBuilderService.validate(def.schema, values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      // Jump to the first tab containing an error
      const schema: FormSchema = def.schema;
      const firstErrorKey = Object.keys(validationErrors)[0];
      const tabIdx = schema.tabs.findIndex(t =>
        t.sections.some(s => s.fields.some(f => f.key === firstErrorKey))
      );
      if (tabIdx >= 0) setActiveTab(tabIdx);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (f: FormFieldDef) => {
    const val = values[f.key];
    const err = errors[f.key];
    const disabled = readOnly || f.readonly;
    const inputClass = `quote-form-input ${err ? '!border-[var(--status-danger-border)]' : ''}`;

    const control = (() => {
      switch (f.type) {
        case 'textarea':
        case 'richtext':
          return (
            <textarea
              className={`quote-form-textarea ${err ? '!border-[var(--status-danger-border)]' : ''}`}
              rows={f.type === 'richtext' ? 6 : 3}
              value={String(val ?? '')}
              placeholder={f.placeholder}
              disabled={disabled}
              onChange={e => setValue(f.key, e.target.value)}
            />
          );
        case 'number':
        case 'currency':
          return (
            <input
              type="number"
              step={f.type === 'currency' ? '0.01' : 'any'}
              className={inputClass}
              value={val === undefined || val === null ? '' : String(val)}
              placeholder={f.type === 'currency' ? '0.00' : f.placeholder}
              disabled={disabled}
              onChange={e => setValue(f.key, e.target.value === '' ? null : Number(e.target.value))}
            />
          );
        case 'date':
          return <input type="date" className={inputClass} value={String(val ?? '')} disabled={disabled} onChange={e => setValue(f.key, e.target.value)} />;
        case 'time':
          return <input type="time" className={inputClass} value={String(val ?? '')} disabled={disabled} onChange={e => setValue(f.key, e.target.value)} />;
        case 'dropdown':
          return (
            <select className={inputClass} value={String(val ?? '')} disabled={disabled} onChange={e => setValue(f.key, e.target.value)}>
              <option value="">{f.placeholder || 'Select…'}</option>
              {(f.options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          );
        case 'multiselect': {
          const selected = Array.isArray(val) ? (val as string[]) : [];
          return (
            <div className="flex flex-wrap gap-1.5">
              {(f.options || []).map(o => {
                const active = selected.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => setValue(f.key, active ? selected.filter(v => v !== o.value) : [...selected, o.value])}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border cursor-pointer transition-colors ${
                      active
                        ? 'bg-[var(--primary)] text-[var(--bg-card)] border-[var(--primary)]'
                        : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--text-muted)]'
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          );
        }
        case 'checkbox':
          return (
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer mt-1">
              <input type="checkbox" checked={!!val} disabled={disabled} onChange={e => setValue(f.key, e.target.checked)} />
              {f.placeholder || f.label}
            </label>
          );
        case 'radio':
          return (
            <div className="flex gap-4 flex-wrap mt-1">
              {(f.options || []).map(o => (
                <label key={o.value} className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer">
                  <input
                    type="radio"
                    name={f.key}
                    checked={val === o.value}
                    disabled={disabled}
                    onChange={() => setValue(f.key, o.value)}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          );
        case 'file':
        case 'image':
          return (
            <input
              type="file"
              accept={f.type === 'image' ? 'image/*' : undefined}
              className={inputClass}
              disabled={disabled}
              onChange={e => setValue(f.key, e.target.files?.[0] || null)}
            />
          );
        case 'signature':
          return (
            <div className="border border-dashed border-[var(--border-color)] rounded-md h-20 flex items-center justify-center text-xs text-[var(--text-muted)]">
              Signature capture (use module signature pad)
            </div>
          );
        case 'table':
          return (
            <textarea
              className="quote-form-textarea font-mono !text-xs"
              rows={4}
              value={typeof val === 'string' ? val : JSON.stringify(val ?? [], null, 0)}
              placeholder='[{"item":"...","qty":1}]'
              disabled={disabled}
              onChange={e => setValue(f.key, e.target.value)}
            />
          );
        default:
          return (
            <input
              className={inputClass}
              value={String(val ?? '')}
              placeholder={f.placeholder}
              disabled={disabled}
              onChange={e => setValue(f.key, e.target.value)}
            />
          );
      }
    })();

    return (
      <div key={f.id} className={`quote-form-group ${['textarea', 'richtext', 'table', 'multiselect'].includes(f.type) ? 'col-span-full' : ''}`}>
        {f.type !== 'checkbox' && (
          <label>
            {f.label} {f.required && <span className="text-[var(--error)]">*</span>}
          </label>
        )}
        {control}
        {err && <p className="text-xs text-[var(--error)] mt-0.5">{err}</p>}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="py-10 flex justify-center">
        <div className="h-5 w-5 border-2 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin rounded-full" />
      </div>
    );
  }

  if (!def) return null;

  const schema = def.schema;
  const tab = schema.tabs[activeTab];

  return (
    <form onSubmit={handleSubmit} className={`flex flex-col gap-5 ${className}`}>
      {/* Tabs */}
      {schema.tabs.length > 1 && (
        <div className="flex gap-0 border-b border-[var(--border-color)] overflow-x-auto">
          {schema.tabs.map((t, i) => {
            const hasError = t.sections.some(s => s.fields.some(f => errors[f.key]));
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(i)}
                className={`px-3.5 py-2 text-xs font-medium border-b-2 whitespace-nowrap cursor-pointer transition-colors -mb-px ${
                  i === activeTab
                    ? 'text-[var(--text-primary)] border-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]'
                }`}
              >
                {t.label}
                {hasError && <span className="text-[var(--error)] ml-1">•</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Sections */}
      {tab?.sections.map(sec => {
        const visibleFields = sec.fields.filter(f => formBuilderService.isFieldVisible(f, values));
        if (visibleFields.length === 0) return null;
        return (
          <div key={sec.id} className="flex flex-col gap-3">
            <h4 className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border-color)] pb-1.5">
              {sec.label}
            </h4>
            <div className={`grid gap-3.5 ${sec.columns === 1 ? 'grid-cols-1' : sec.columns === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
              {visibleFields.map(renderField)}
            </div>
          </div>
        );
      })}

      {!readOnly && (
        <div className="flex justify-end border-t border-[var(--border-color)] pt-4">
          <Button type="submit" variant="primary" size="md" icon={Save} isLoading={submitting}>
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
};

export default DynamicForm;
