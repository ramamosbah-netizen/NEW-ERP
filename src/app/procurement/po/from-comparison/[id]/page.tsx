// ============================================================
// JEET ERP — Generate POs From Approved Comparison Sheet
// Route: /procurement/po/from-comparison/[id]
// ============================================================

'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { poFromComparisonService, type POProposal } from '@/services/poFromComparisonService';
import { poService } from '@/services/poService';
import { ArrowLeft, RefreshCw, FileText, CheckSquare, Square, Truck, Calendar, Save, AlertCircle } from 'lucide-react';
import '@/app/procurement/comparisons/comparisons.css';

const fmtAED = (v: number) => {
  return 'AED ' + new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function POFromComparisonPage({ params }: PageProps) {
  const router = useRouter();
  const { id: comparisonId } = use(params);

  const [comparison, setComparison] = useState<any | null>(null);
  const [proposals, setProposals] = useState<POProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Record<string, boolean>>({});
  const [formStates, setFormStates] = useState<Record<string, {
    delivery_address: string;
    promised_delivery_days: number;
    required_delivery_date: string;
    notes_to_supplier: string;
    proforma: File | null;
  }>>({});
  const [error, setError] = useState<string | null>(null);

  // Load comparison sheet proposals
  useEffect(() => {
    async function loadProposals() {
      if (!comparisonId) return;
      try {
        setLoading(true);
        setError(null);
        
        const { comparison: comp, proposals: props } = 
          await poFromComparisonService.generatePOProposalsFromComparison(comparisonId);
        
        setComparison(comp);
        setProposals(props);

        // By default, select all supplier proposals
        const selectedMap: Record<string, boolean> = {};
        const statesMap: Record<string, any> = {};

        props.forEach(p => {
          selectedMap[p.supplier_id] = true;
          statesMap[p.supplier_id] = {
            delivery_address: comp.project_address || '',
            promised_delivery_days: 7,
            required_delivery_date: '',
            notes_to_supplier: '',
            proforma: null
          };
        });

        setSelectedSuppliers(selectedMap);
        setFormStates(statesMap);

      } catch (err: any) {
        logger.error('Failed to generate PO proposals:', err);
        setError(err.message || 'Failed to generate PO proposals from the comparison sheet.');
      } finally {
        setLoading(false);
      }
    }

    loadProposals();
  }, [comparisonId]);

  const toggleSupplier = (supplierId: string) => {
    setSelectedSuppliers(prev => ({
      ...prev,
      [supplierId]: !prev[supplierId]
    }));
  };

  const handleFormChange = (supplierId: string, field: string, value: any) => {
    setFormStates(prev => ({
      ...prev,
      [supplierId]: {
        ...prev[supplierId],
        [field]: value
      }
    }));
  };

  const handleGenerateDrafts = async () => {
    try {
      setSaving(true);
      setError(null);

      const activeProposals = proposals.filter(p => selectedSuppliers[p.supplier_id]);
      if (activeProposals.length === 0) {
        setError('Please select at least one supplier proposal to generate an LPO.');
        setSaving(false);
        return;
      }

      // Check projects linked (since comparison is linked to tender, we need to find the project where tender_id = comparison.project_id)
      const { data: project } = await supabase
        .from('projects')
        .select('id, name')
        .eq('tender_id', comparison.project_id)
        .maybeSingle();

      if (!project && comparison.origin !== 'OVERHEAD') {
        setError('No active project is linked to this comparison tender. Please create the Project Master first.');
        setSaving(false);
        return;
      }

      // Create drafts sequentially
      for (const prop of activeProposals) {
        const state = formStates[prop.supplier_id];
        
        const poHeader: any = {
          origin: 'FROM_COMPARISON',
          comparison_id: comparisonId,
          project_id: project ? project.id : null,
          po_type: 'PROJECT_MATERIAL', // Default type
          supplier_id: prop.supplier_id,
          supplier_name: prop.supplier_name,
          supplier_trn: prop.supplier_details?.trn || null,
          supplier_contact: prop.supplier_details?.contact_person || null,
          supplier_email: prop.supplier_details?.email || null,
          supplier_phone: prop.supplier_details?.phone || null,
          delivery_address: state.delivery_address || null,
          required_delivery_date: state.required_delivery_date || null,
          promised_delivery_days: state.promised_delivery_days || null,
          payment_terms_days: prop.payment_terms_days,
          payment_terms_text: `${prop.payment_terms_days} Days Net`,
          subtotal: prop.subtotal,
          discount_amount: 0.00,
          vat_amount: prop.vat_amount,
          total: prop.total,
          no_comparison_justification: null,
          terms_conditions: null,
          notes_to_supplier: state.notes_to_supplier || null,
          internal_notes: `Generated automatically from approved comparison sheet ${comparison.comparison_number}`,
        };

        const formattedItems = prop.items.map(it => ({
          comparison_item_id: it.comparison_item_id,
          description: it.description,
          brand: it.brand || null,
          unit: it.unit,
          quantity: it.quantity,
          unit_price: it.unit_price,
          discount_pct: 0,
          vat_applicable: it.vat_applicable,
          line_total: it.line_total,
          system: it.system
        }));

        const newPoId = await poService.createPO(poHeader, formattedItems);

        // Attach the supplier's proforma invoice to the new LPO (optional)
        if (newPoId && state?.proforma) {
          try {
            const file = state.proforma;
            const path = `PO/${newPoId}/PROFORMA_${Date.now()}_${file.name}`;
            const { error: upErr } = await supabase.storage
              .from('tender-documents')
              .upload(path, file, { cacheControl: '3600', upsert: true });
            if (upErr) throw upErr;
            const { error: dbErr } = await supabase
              .from('purchase_orders')
              .update({
                proforma_invoice_path: path,
                proforma_invoice_name: file.name,
                proforma_invoice_uploaded_at: new Date().toISOString(),
              })
              .eq('id', newPoId);
            if (dbErr) {
              logger.warn('Proforma uploaded but reference not saved (apply migration 20260613140000):', dbErr.message);
            }
          } catch (pfErr: any) {
            logger.warn(`Proforma upload failed for ${prop.supplier_name}:`, pfErr.message);
          }
        }
      }

      router.push('/procurement/po');

    } catch (err: any) {
      logger.error('Failed to generate LPO drafts:', err);
      setError(err.message || 'An error occurred while generating LPO drafts.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="comp-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Generating procurement draft splits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="comp-container">
      {/* Header */}
      <header className="comp-header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href={`/procurement/comparisons/${comparisonId}`} className="quote-btn quote-btn-secondary" style={{ padding: '0.5rem' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="comp-header-title">Generate LPOs from Comparison</h1>
            <p className="comp-header-subtitle">
              Sheet Ref: <span style={{ color: 'var(--primary)' }}>{comparison?.comparison_number}</span> (Rev {comparison?.revision}) | Project: {comparison?.project_name}
            </p>
          </div>
        </div>
        
        <button 
          className="quote-btn quote-btn-primary" 
          onClick={handleGenerateDrafts}
          disabled={saving || proposals.length === 0}
        >
          {saving ? <RefreshCw size={16} className="spinner" /> : <Save size={16} />} Create LPO Drafts
        </button>
      </header>

      {/* Error Message */}
      {error && (
        <div className="quote-card" style={{ borderLeft: '4px solid var(--error)', background: 'rgba(239, 68, 68, 0.05)', padding: '1.2rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <AlertCircle size={18} style={{ color: 'var(--error)' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{error}</span>
          </div>
        </div>
      )}

      {proposals.length === 0 ? (
        <div className="quote-card" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <FileText size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
          <p>No selected supplier offers found in this comparison sheet to generate LPOs from.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.8rem' }}>
          <div className="quote-card" style={{ padding: '1.2rem', background: 'rgba(0, 229, 160, 0.03)', borderColor: 'rgba(0, 229, 160, 0.15)' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
              The system has analyzed comparison sheet <strong>{comparison?.comparison_number}</strong> and detected <strong>{proposals.length}</strong> unique suppliers selected for items. Check the boxes below to configure and generate individual draft LPO contracts.
            </p>
          </div>

          {proposals.map((prop) => {
            const isSelected = !!selectedSuppliers[prop.supplier_id];
            const state = formStates[prop.supplier_id];

            return (
              <div 
                key={prop.supplier_id} 
                className="quote-card" 
                style={{ 
                  border: isSelected ? '1px solid rgba(0, 229, 160, 0.25)' : '1px solid var(--surface-hover)',
                  background: isSelected ? 'rgba(0, 229, 160, 0.01)' : 'var(--surface-hover)'
                }}
              >
                {/* Proposal Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <button 
                      onClick={() => toggleSupplier(prop.supplier_id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      {isSelected ? (
                        <CheckSquare size={20} style={{ color: 'var(--primary)' }} />
                      ) : (
                        <Square size={20} style={{ color: 'var(--text-muted)' }} />
                      )}
                    </button>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: isSelected ? 'var(--primary)' : 'var(--text-primary)' }}>
                        {prop.supplier_name}
                      </h3>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                        Contact: {prop.supplier_details?.contact_person || 'N/A'} | Payment terms: {prop.payment_terms_days} days
                      </p>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Split LPO Value</span>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--secondary)', fontFamily: 'var(--font-mono)' }}>
                      {fmtAED(prop.total)}
                    </div>
                  </div>
                </div>

                {/* Proposal configuration (Only visible if selected) */}
                {isSelected && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', marginBottom: '1.2rem' }}>
                    {/* Form coordinates */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderRight: '1px solid var(--border-color)', paddingRight: '1.5rem' }}>
                      <h4 style={{ fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Delivery Coordinates</h4>
                      
                      <div>
                        <label className="quote-input-label">Required Delivery Date</label>
                        <div style={{ position: 'relative' }}>
                          <Calendar size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
                          <input 
                            type="date" 
                            className="quote-filter-input" 
                            style={{ width: '100%', paddingLeft: '2.2rem' }}
                            value={state.required_delivery_date}
                            onChange={(e) => handleFormChange(prop.supplier_id, 'required_delivery_date', e.target.value)}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="quote-input-label">Promised Days (from LPO)</label>
                        <input 
                          type="number" 
                          className="quote-filter-input" 
                          style={{ width: '100%' }}
                          value={state.promised_delivery_days}
                          onChange={(e) => handleFormChange(prop.supplier_id, 'promised_delivery_days', Number(e.target.value) || 0)}
                        />
                      </div>

                      <div>
                        <label className="quote-input-label">Delivery Site Address</label>
                        <input 
                          type="text" 
                          className="quote-filter-input" 
                          style={{ width: '100%' }}
                          placeholder="Project site location"
                          value={state.delivery_address}
                          onChange={(e) => handleFormChange(prop.supplier_id, 'delivery_address', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="quote-input-label">Notes to Supplier</label>
                        <textarea
                          className="quote-filter-input"
                          style={{ width: '100%', minHeight: '60px', padding: '0.5rem', resize: 'vertical' }}
                          placeholder="Special shipping directions..."
                          value={state.notes_to_supplier}
                          onChange={(e) => handleFormChange(prop.supplier_id, 'notes_to_supplier', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="quote-input-label">Supplier Proforma Invoice <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                        <input
                          type="file"
                          className="quote-filter-input"
                          style={{ width: '100%' }}
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={(e) => handleFormChange(prop.supplier_id, 'proforma', e.target.files?.[0] || null)}
                        />
                        {state.proforma && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--success)', display: 'block', marginTop: '0.3rem' }}>
                            Attached: {state.proforma.name} ({(state.proforma.size / 1024).toFixed(0)} KB)
                          </span>
                        )}
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
                          Will be attached to this supplier&apos;s LPO on generation.
                        </span>
                      </div>
                    </div>

                    {/* Items preview list */}
                    <div>
                      <h4 style={{ fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>Split Line Items</h4>
                      <div className="quote-table-wrap" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                        <table className="quote-table" style={{ fontSize: '0.78rem' }}>
                          <thead>
                            <tr>
                              <th>Description</th>
                              <th>Brand Offered</th>
                              <th>Unit</th>
                              <th style={{ textAlign: 'right' }}>Qty</th>
                              <th style={{ textAlign: 'right' }}>Unit Cost</th>
                              <th style={{ textAlign: 'right' }}>Line Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {prop.items.map((it, i) => (
                              <tr key={i}>
                                <td>{it.description}</td>
                                <td>{it.brand || '-'}</td>
                                <td>{it.unit}</td>
                                <td style={{ textAlign: 'right' }}>{it.quantity}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{it.unit_price.toFixed(2)}</td>
                                <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{it.line_total.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.8rem', fontSize: '0.8rem', color: 'var(--text-secondary)', gap: '1.2rem' }}>
                        <div>Subtotal: <span style={{ fontWeight: 600, color: '#fff' }}>{fmtAED(prop.subtotal)}</span></div>
                        <div>5% VAT: <span style={{ fontWeight: 600, color: '#fff' }}>{fmtAED(prop.vat_amount)}</span></div>
                        <div>Total: <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{fmtAED(prop.total)}</span></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
