// ============================================================
// JEET ERP — Edit Draft Quotation Page
// Routes: /quotations/:id/edit
// ============================================================

'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  Check, 
  ChevronRight, 
  User, 
  FileText, 
  Settings, 
  CheckCircle,
  AlertCircle,
  DollarSign,
  Plus,
  Trash2,
  Lock
} from 'lucide-react';
import { amountToWords } from '@/lib/amount-to-words';
import { quotationService } from '@/lib/quotation-service';
import { useQuotation, useQuotationTemplates } from '@/hooks/useQuotations';
import '../../quotations.css';

const fmtAED = (v: number) => {
  return 'AED ' + new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

export default function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  // States
  const { quotation, loading: loadingQuote, error: quoteError, actions } = useQuotation(id);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Client list
  const [clients, setClients] = useState<any[]>([]);

  // Clause templates
  const { templates } = useQuotationTemplates();

  // Quotation fields state
  const [quoteHeader, setQuoteHeader] = useState<any>({
    quotation_number: '',
    project_ref: '',
    tender_ref: '',
    client_id: '',
    client_name: '',
    client_address_line1: '',
    client_address_line2: '',
    client_city: '',
    client_country: 'UAE',
    client_contact_person: '',
    client_contact_email: '',
    client_contact_phone: '',
    quotation_date: '',
    valid_until: '',
    subject: '',
    scope_summary: '',
    discount_amount: 0,
    payment_terms: '',
    delivery_period: '',
    warranty_terms: '',
    terms_and_conditions: '',
    exclusions: '',
    inclusions: '',
    notes_internal: '',
    notes_client: ''
  });

  const [quoteLines, setQuoteLines] = useState<any[]>([]);

  // Initialize form details when quotation is loaded
  useEffect(() => {
    if (quotation) {
      if (quotation.status !== 'DRAFT') {
        setErrorMsg('Only DRAFT quotations can be edited.');
        setLoading(false);
        return;
      }

      setQuoteHeader({
        quotation_number: quotation.quotation_number,
        project_ref: quotation.project_ref,
        tender_ref: quotation.tender_ref || '',
        client_id: quotation.client_id,
        client_name: quotation.client_name,
        client_address_line1: quotation.client_address_line1 || '',
        client_address_line2: quotation.client_address_line2 || '',
        client_city: quotation.client_city || '',
        client_country: quotation.client_country || 'UAE',
        client_contact_person: quotation.client_contact_person || '',
        client_contact_email: quotation.client_contact_email || '',
        client_contact_phone: quotation.client_contact_phone || '',
        quotation_date: quotation.quotation_date,
        valid_until: quotation.valid_until,
        subject: quotation.subject,
        scope_summary: quotation.scope_summary || '',
        discount_amount: quotation.discount_amount || 0,
        payment_terms: quotation.payment_terms || '',
        delivery_period: quotation.delivery_period || '',
        warranty_terms: quotation.warranty_terms || '',
        terms_and_conditions: quotation.terms_and_conditions || '',
        exclusions: quotation.exclusions || '',
        inclusions: quotation.inclusions || '',
        notes_internal: quotation.notes_internal || '',
        notes_client: quotation.notes_client || ''
      });

      setQuoteLines(quotation.lines || []);
      setLoading(false);

      // Load clients
      supabase.from('clients').select('*').then(({ data }) => {
        if (data) setClients(data);
      });
    }
  }, [quotation]);

  const handleClientSelect = (clientId: string) => {
    const selected = clients.find(c => c.id === clientId);
    if (selected) {
      setQuoteHeader((prev: any) => ({
        ...prev,
        client_id: selected.id,
        client_name: selected.name,
        client_address_line1: selected.address_line1 || '',
        client_address_line2: selected.address_line2 || '',
        client_city: selected.city || '',
        client_country: selected.country || 'UAE',
        client_contact_person: selected.contact_person || '',
        client_contact_email: selected.contact_email || '',
        client_contact_phone: selected.contact_phone || ''
      }));
    }
  };

  const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setQuoteHeader((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleLineChange = (index: number, field: string, value: any) => {
    const updated = [...quoteLines];
    const line = { ...updated[index] };
    
    line[field] = value;
    
    if (field === 'quantity' || field === 'unit_sell_price' || field === 'discount_pct') {
      const qty = Number(line.quantity) || 0;
      const price = Number(line.unit_sell_price) || 0;
      const disc = Number(line.discount_pct) || 0;
      
      const afterDisc = Math.round(price * (1 - disc / 100) * 100) / 100;
      line.unit_sell_price_after_discount = afterDisc;
      line.line_total = qty * afterDisc;
    }
    
    updated[index] = line;
    setQuoteLines(updated);
  };

  const handleAddManualLine = () => {
    setQuoteLines(prev => [
      ...prev,
      {
        line_number: prev.length + 1,
        pricing_item_id: null,
        item_code: 'MAN-LINE',
        description: 'Manual line description',
        system: 'ELV',
        category: 'General',
        unit: 'EA',
        quantity: 1,
        unit_sell_price: 0,
        discount_pct: 0,
        unit_sell_price_after_discount: 0,
        line_total: 0,
        vat_applicable: true,
        is_optional: false,
        notes: ''
      }
    ]);
  };

  const handleRemoveLine = (index: number) => {
    setQuoteLines(prev => prev.filter((_, idx) => idx !== index).map((l, i) => ({ ...l, line_number: i + 1 })));
  };

  const handleMoveLine = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= quoteLines.length) return;
    const updated = [...quoteLines];
    const temp = updated[index];
    updated[index] = updated[nextIndex];
    updated[nextIndex] = temp;
    
    const reindexed = updated.map((l, idx) => ({ ...l, line_number: idx + 1 }));
    setQuoteLines(reindexed);
  };

  const loadClauseTemplate = (type: string) => {
    const matched = templates.filter(t => t.template_type === type);
    if (matched.length === 0) return;
    const tpl = matched[0];
    setQuoteHeader((prev: any) => ({
      ...prev,
      [type === 'PAYMENT' ? 'payment_terms' : 
       type === 'WARRANTY' ? 'warranty_terms' : 
       type === 'TERMS' ? 'terms_and_conditions' : 
       type === 'EXCLUSIONS' ? 'exclusions' : 'inclusions']: tpl.content
    }));
  };

  // Live total calculations
  const calculateSubtotal = () => {
    return quoteLines.filter(l => !l.is_optional).reduce((sum, line) => sum + (Number(line.line_total) || 0), 0);
  };

  const subtotal = calculateSubtotal();
  const discount = Number(quoteHeader.discount_amount) || 0;
  const subtotalAfterDiscount = Math.max(0, subtotal - discount);
  const vat = Math.round(subtotalAfterDiscount * 0.05 * 100) / 100;
  const grandTotal = subtotalAfterDiscount + vat;
  const totalInWords = amountToWords(subtotalAfterDiscount, 'AED');

  // Save changes
  const handleSaveChanges = async () => {
    try {
      setSaving(true);
      setErrorMsg('');

      await quotationService.updateQuotation(id, {
        ...quoteHeader,
        lines: quoteLines
      });

      alert('Quotation draft successfully updated!');
      router.push(`/quotations/${id}`);
    } catch (err: any) {
      console.error('Error updating quotation:', err);
      setErrorMsg(err.message || 'Failed to update quotation draft');
    } finally {
      setSaving(false);
    }
  };

  if (loadingQuote || loading) {
    return (
      <div className="quote-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading quotation details...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="quote-container">
        <div className="quote-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)', textAlign: 'center', padding: '3rem' }}>
          <Lock size={48} style={{ color: '#ef4444', margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', marginBottom: '1rem' }}>Locked Quotation</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{errorMsg}</p>
          <Link href={`/quotations/${id}`} className="quote-btn quote-btn-secondary">
            <ArrowLeft size={14} /> Back to Details
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="quote-container">
      {/* Header */}
      <header className="quote-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href={`/quotations/${id}`} className="quote-btn quote-btn-secondary" style={{ padding: '0.4rem 0.6rem' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="quote-header-title">Edit Draft: {quoteHeader.quotation_number}</h1>
            <p className="quote-header-subtitle">Step {step} of 4: {step === 1 ? 'Client & Header Details' : step === 2 ? 'Line Items & Pricing' : step === 3 ? 'Commercial Clauses' : 'Review & Save'}</p>
          </div>
        </div>
      </header>

      {/* Progress indicators */}
      <div className="quote-card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {['Details', 'Line Items', 'Commercial Terms', 'Review'].map((label, idx) => (
            <div 
              key={label} 
              style={{ 
                flex: 1, 
                textAlign: 'center', 
                borderBottom: `2px solid ${step > idx + 1 ? 'var(--success)' : step === idx + 1 ? '#00E5A0' : 'rgba(255,255,255,0.06)'}`,
                paddingBottom: '0.5rem',
                color: step === idx + 1 ? '#00E5A0' : step > idx + 1 ? 'var(--success)' : 'var(--text-muted)',
                fontWeight: step === idx + 1 ? 700 : 500,
                fontSize: '0.8rem'
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="quote-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STEP 1: HEADER & CLIENT */}
      {step === 1 && (
        <div className="quote-card">
          <div className="quote-card-header">
            <h3 className="quote-card-title"><User size={18} /> Client & Document Details</h3>
          </div>
          
          <div className="quote-form-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="quote-form-group">
              <label>Project Reference</label>
              <input type="text" name="project_ref" className="quote-form-input" value={quoteHeader.project_ref} onChange={handleHeaderChange} />
            </div>
            <div className="quote-form-group">
              <label>Tender Reference</label>
              <input type="text" name="tender_ref" className="quote-form-input" value={quoteHeader.tender_ref} onChange={handleHeaderChange} />
            </div>
            <div className="quote-form-group">
              <label>Quotation Date</label>
              <input type="date" name="quotation_date" className="quote-form-input" value={quoteHeader.quotation_date} onChange={handleHeaderChange} />
            </div>
            <div className="quote-form-group">
              <label>Valid Until</label>
              <input type="date" name="valid_until" className="quote-form-input" value={quoteHeader.valid_until} onChange={handleHeaderChange} />
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="quote-form-grid" style={{ marginBottom: '1rem' }}>
              <div className="quote-form-group">
                <label>Select Existing Client</label>
                <select 
                  className="quote-form-input" 
                  value={quoteHeader.client_id} 
                  onChange={(e) => handleClientSelect(e.target.value)}
                >
                  <option value="">-- Search & Select Customer --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="quote-form-group">
                <label>Client Name (Snapshot)</label>
                <input type="text" name="client_name" className="quote-form-input" value={quoteHeader.client_name} onChange={handleHeaderChange} />
              </div>
              <div className="quote-form-group">
                <label>Attn: Contact Person</label>
                <input type="text" name="client_contact_person" className="quote-form-input" value={quoteHeader.client_contact_person} onChange={handleHeaderChange} />
              </div>
            </div>

            <div className="quote-form-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="quote-form-group">
                <label>Address Line 1</label>
                <input type="text" name="client_address_line1" className="quote-form-input" value={quoteHeader.client_address_line1} onChange={handleHeaderChange} />
              </div>
              <div className="quote-form-group">
                <label>Address Line 2</label>
                <input type="text" name="client_address_line2" className="quote-form-input" value={quoteHeader.client_address_line2} onChange={handleHeaderChange} />
              </div>
              <div className="quote-form-group">
                <label>City</label>
                <input type="text" name="client_city" className="quote-form-input" value={quoteHeader.client_city} onChange={handleHeaderChange} />
              </div>
              <div className="quote-form-group">
                <label>Country</label>
                <input type="text" name="client_country" className="quote-form-input" value={quoteHeader.client_country} onChange={handleHeaderChange} />
              </div>
            </div>

            <div className="quote-form-grid">
              <div className="quote-form-group">
                <label>Contact Email</label>
                <input type="email" name="client_contact_email" className="quote-form-input" value={quoteHeader.client_contact_email || ''} onChange={handleHeaderChange} />
              </div>
              <div className="quote-form-group">
                <label>Contact Phone</label>
                <input type="text" name="client_contact_phone" className="quote-form-input" value={quoteHeader.client_contact_phone || ''} onChange={handleHeaderChange} />
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem' }}>
            <div className="quote-form-group" style={{ marginBottom: '1.2rem' }}>
              <label>Quotation Subject</label>
              <input type="text" name="subject" className="quote-form-input" value={quoteHeader.subject} onChange={handleHeaderChange} />
            </div>
            <div className="quote-form-group">
              <label>Scope of Work (PDF cover paragraph)</label>
              <textarea name="scope_summary" className="quote-form-textarea" style={{ minHeight: '120px' }} value={quoteHeader.scope_summary} onChange={handleHeaderChange} />
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: LINE ITEMS */}
      {step === 2 && (
        <div className="quote-card">
          <div className="quote-card-header">
            <h3 className="quote-card-title"><DollarSign size={18} /> Quotation Line Items</h3>
            <button className="quote-btn quote-btn-secondary" style={{ padding: '0.4rem 0.8rem' }} onClick={handleAddManualLine}>
              <Plus size={14} /> Add Line Item
            </button>
          </div>

          <div className="quote-table-wrap" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
            <table className="quote-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>Move</th>
                  <th style={{ width: '120px' }}>Item Code</th>
                  <th>Description</th>
                  <th style={{ width: '120px' }}>System</th>
                  <th style={{ width: '60px' }}>Unit</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>Qty</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Sell Price (AED)</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>Disc %</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Total (AED)</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Optional</th>
                  <th style={{ width: '60px', textAlign: 'center' }}>Delete</th>
                </tr>
              </thead>
              <tbody>
                {quoteLines.map((line: any, index: number) => (
                  <tr key={index}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'center' }}>
                        <button type="button" style={{ background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => handleMoveLine(index, 'up')}>▲</button>
                        <button type="button" style={{ background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => handleMoveLine(index, 'down')}>▼</button>
                      </div>
                    </td>
                    <td>
                      <input 
                        type="text" 
                        className="quote-filter-input" 
                        style={{ padding: '0.3rem', width: '100%', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }} 
                        value={line.item_code} 
                        onChange={(e) => handleLineChange(index, 'item_code', e.target.value)} 
                      />
                    </td>
                    <td>
                      <textarea 
                        className="quote-form-textarea" 
                        style={{ minHeight: '34px', padding: '0.3rem', width: '100%', fontSize: '0.8rem' }}
                        value={line.description} 
                        onChange={(e) => handleLineChange(index, 'description', e.target.value)} 
                      />
                    </td>
                    <td>
                      <input 
                        type="text" 
                        className="quote-filter-input" 
                        style={{ padding: '0.3rem', width: '100%', fontSize: '0.8rem' }} 
                        value={line.system} 
                        onChange={(e) => handleLineChange(index, 'system', e.target.value)} 
                      />
                    </td>
                    <td>
                      <input 
                        type="text" 
                        className="quote-filter-input" 
                        style={{ padding: '0.3rem', width: '100%', textAlign: 'center', fontSize: '0.8rem' }} 
                        value={line.unit} 
                        onChange={(e) => handleLineChange(index, 'unit', e.target.value)} 
                      />
                    </td>
                    <td>
                      <input 
                        type="number" 
                        className="quote-filter-input" 
                        style={{ padding: '0.3rem', width: '100%', textAlign: 'right', fontSize: '0.8rem' }} 
                        value={line.quantity} 
                        onChange={(e) => handleLineChange(index, 'quantity', parseFloat(e.target.value) || 0)} 
                      />
                    </td>
                    <td>
                      <input 
                        type="number" 
                        className="quote-filter-input" 
                        style={{ padding: '0.3rem', width: '100%', textAlign: 'right', fontSize: '0.8rem' }} 
                        value={line.unit_sell_price} 
                        onChange={(e) => handleLineChange(index, 'unit_sell_price', parseFloat(e.target.value) || 0)} 
                      />
                    </td>
                    <td>
                      <input 
                        type="number" 
                        className="quote-filter-input" 
                        style={{ padding: '0.3rem', width: '100%', textAlign: 'right', fontSize: '0.8rem' }} 
                        value={line.discount_pct} 
                        max={100}
                        min={0}
                        onChange={(e) => handleLineChange(index, 'discount_pct', parseFloat(e.target.value) || 0)} 
                      />
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, paddingRight: '1rem', color: 'var(--text-primary)' }}>
                      {fmtAED(line.line_total)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={line.is_optional} 
                        onChange={(e) => handleLineChange(index, 'is_optional', e.target.checked)} 
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button type="button" style={{ background: 'transparent', cursor: 'pointer', color: '#ef4444' }} onClick={() => handleRemoveLine(index)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Calculator summaries */}
          <div className="quote-live-footer">
            <div className="quote-live-row">
              <span>Subtotal (Excl. VAT):</span>
              <span>{fmtAED(subtotal)}</span>
            </div>
            <div className="quote-live-row" style={{ alignItems: 'center' }}>
              <span>Additional Discount (AED):</span>
              <input 
                type="number" 
                name="discount_amount" 
                className="quote-filter-input" 
                style={{ padding: '0.2rem', width: '120px', textAlign: 'right', height: '24px', fontSize: '0.8rem' }} 
                value={quoteHeader.discount_amount} 
                onChange={handleHeaderChange} 
              />
            </div>
            <div className="quote-live-row">
              <span>Subtotal after Discount:</span>
              <span>{fmtAED(subtotalAfterDiscount)}</span>
            </div>
            <div className="quote-live-row">
              <span>VAT @ 5%:</span>
              <span>{fmtAED(vat)}</span>
            </div>
            <div className="quote-live-row highlight">
              <span>GRAND TOTAL (inc VAT):</span>
              <span>{fmtAED(grandTotal)}</span>
            </div>
            <div className="quote-words">
              <strong>In Words (Excl. VAT):</strong><br />
              {totalInWords}
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: CLAUSES */}
      {step === 3 && (
        <div className="quote-card">
          <div className="quote-card-header">
            <h3 className="quote-card-title"><Settings size={18} /> Commercial Terms & Clauses</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div className="quote-form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Payment Terms</label>
                <button type="button" className="quote-btn quote-btn-secondary" style={{ padding: '2px 8px', fontSize: '0.72rem' }} onClick={() => loadClauseTemplate('PAYMENT')}>
                  Reload Template ↗
                </button>
              </div>
              <textarea name="payment_terms" className="quote-form-textarea" value={quoteHeader.payment_terms} onChange={handleHeaderChange} />
            </div>

            <div className="quote-form-group">
              <label>Delivery Period</label>
              <input type="text" name="delivery_period" className="quote-form-input" value={quoteHeader.delivery_period} onChange={handleHeaderChange} />
            </div>

            <div className="quote-form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Warranty Terms</label>
                <button type="button" className="quote-btn quote-btn-secondary" style={{ padding: '2px 8px', fontSize: '0.72rem' }} onClick={() => loadClauseTemplate('WARRANTY')}>
                  Reload Template ↗
                </button>
              </div>
              <textarea name="warranty_terms" className="quote-form-textarea" value={quoteHeader.warranty_terms} onChange={handleHeaderChange} />
            </div>

            <div className="quote-form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Terms & Conditions</label>
                <button type="button" className="quote-btn quote-btn-secondary" style={{ padding: '2px 8px', fontSize: '0.72rem' }} onClick={() => loadClauseTemplate('TERMS')}>
                  Reload Template ↗
                </button>
              </div>
              <textarea name="terms_and_conditions" className="quote-form-textarea" style={{ minHeight: '140px' }} value={quoteHeader.terms_and_conditions} onChange={handleHeaderChange} />
            </div>

            <div className="quote-form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Inclusions</label>
                <button type="button" className="quote-btn quote-btn-secondary" style={{ padding: '2px 8px', fontSize: '0.72rem' }} onClick={() => loadClauseTemplate('INCLUSIONS')}>
                  Reload Template ↗
                </button>
              </div>
              <textarea name="inclusions" className="quote-form-textarea" style={{ minHeight: '120px' }} value={quoteHeader.inclusions} onChange={handleHeaderChange} />
            </div>

            <div className="quote-form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Exclusions</label>
                <button type="button" className="quote-btn quote-btn-secondary" style={{ padding: '2px 8px', fontSize: '0.72rem' }} onClick={() => loadClauseTemplate('EXCLUSIONS')}>
                  Reload Template ↗
                </button>
              </div>
              <textarea name="exclusions" className="quote-form-textarea" style={{ minHeight: '120px' }} value={quoteHeader.exclusions} onChange={handleHeaderChange} />
            </div>

            <div className="quote-form-grid">
              <div className="quote-form-group">
                <label>Client Notes</label>
                <textarea name="notes_client" className="quote-form-textarea" value={quoteHeader.notes_client} onChange={handleHeaderChange} />
              </div>
              <div className="quote-form-group">
                <label>Internal Notes</label>
                <textarea name="notes_internal" className="quote-form-textarea" value={quoteHeader.notes_internal} onChange={handleHeaderChange} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: PREVIEW */}
      {step === 4 && (
        <div className="quote-card">
          <div className="quote-card-header">
            <h3 className="quote-card-title"><CheckCircle size={18} /> Review Draft Updates</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h4 style={{ fontSize: '0.9rem', color: '#00E5A0', marginBottom: '0.5rem' }}>Header Information</h4>
              <p><strong>Quotation Number:</strong> {quoteHeader.quotation_number}</p>
              <p><strong>Subject:</strong> {quoteHeader.subject}</p>
              <p><strong>Client Name:</strong> {quoteHeader.client_name}</p>
              <p><strong>Project Ref:</strong> {quoteHeader.project_ref}</p>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.9rem', color: '#00E5A0', marginBottom: '0.5rem' }}>Calculated Totals</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: '400px' }}>
                <div>Subtotal Excl. VAT:</div>
                <div style={{ fontWeight: 600 }}>{fmtAED(subtotal)}</div>
                {discount > 0 && (
                  <>
                    <div>Discount:</div>
                    <div style={{ color: '#ef4444' }}>-{fmtAED(discount)}</div>
                  </>
                )}
                <div>VAT (5%):</div>
                <div>{fmtAED(vat)}</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Grand Total:</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#00E5A0' }}>{fmtAED(grandTotal)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation footer */}
      <footer style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
        <button 
          className="quote-btn quote-btn-secondary" 
          disabled={step === 1 || saving} 
          onClick={() => setStep(prev => prev - 1)}
        >
          Previous
        </button>
        {step < 4 ? (
          <button 
            className="quote-btn quote-btn-primary" 
            onClick={() => setStep(prev => prev + 1)}
          >
            Next <ChevronRight size={14} />
          </button>
        ) : (
          <button 
            className="quote-btn quote-btn-primary" 
            disabled={saving} 
            onClick={handleSaveChanges}
          >
            {saving ? 'Saving updates...' : 'Save Quotation Updates'}
          </button>
        )}
      </footer>
    </div>
  );
}
