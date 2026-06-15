// ============================================================
// JEET ERP — Create Quotation Wizard
// Routes: /quotations/new/:boqId
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
  Briefcase,
  DollarSign,
  Layers,
  Sparkles,
  Plus,
  Trash2
} from 'lucide-react';
import { amountToWords } from '@/lib/amount-to-words';
import { quotationService } from '@/lib/quotation-service';
import { useQuotationTemplates } from '@/hooks/useQuotations';
import '../../quotations.css';

const fmtAED = (v: number) => {
  return 'AED ' + new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

export default function CreateQuotationWizard({ params }: { params: Promise<{ boqId: string }> }) {
  const router = useRouter();
  const { boqId } = use(params);

  // Steps state
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Master catalog pricing items map (for variance check)
  const [catalogMap, setCatalogMap] = useState<Record<string, number>>({});

  // Client list for selector
  const [clients, setClients] = useState<any[]>([]);

  // Clause templates
  const { templates } = useQuotationTemplates();

  // Quotation header & details
  const [quoteHeader, setQuoteHeader] = useState<any>({
    quotation_number: '', // auto-gen by DB
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
    quotation_date: new Date().toISOString().split('T')[0],
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    subject: '',
    scope_summary: '',
    discount_amount: 0,
    payment_terms: '',
    delivery_period: '8 weeks from LPO',
    warranty_terms: '',
    terms_and_conditions: '',
    exclusions: '',
    inclusions: '',
    notes_internal: '',
    notes_client: ''
  });

  // Quotation lines
  const [quoteLines, setQuoteLines] = useState<any[]>([]);

  // Load BOQ details
  useEffect(() => {
    const loadBOQData = async () => {
      try {
        setLoading(true);
        // 1. Fetch BOQ
        const { data: boq, error: boqErr } = await supabase
          .from('boqs')
          .select('*, tenders(*)')
          .eq('id', boqId)
          .single();

        if (boqErr || !boq) throw new Error('BOQ not found.');
        
        if (boq.status !== 'finalized') {
          setErrorMsg('Quotation cannot be created if linked BOQ status is not FINALIZED.');
          setLoading(false);
          return;
        }

        // Set default header info from Tender
        const tender = boq.tenders;
        const currentYear = new Date().getFullYear();
        
        // Setup initial client search
        const { data: clientList } = await supabase.from('clients').select('*');
        if (clientList) setClients(clientList);

        // Fetch pricing catalog sell prices to check variance
        const { data: pricingItems } = await supabase
          .from('pricing_items')
          .select('id, sell_price');
        
        const catMap: Record<string, number> = {};
        if (pricingItems) {
          pricingItems.forEach((item: any) => {
            catMap[item.id] = Number(item.sell_price) || 0;
          });
          setCatalogMap(catMap);
        }

        // Parse BOQ items
        const parsedBOQItems = Array.isArray(boq.items) ? boq.items : JSON.parse(boq.items || '[]');
        
        const mappedLines = parsedBOQItems.map((item: any, index: number) => {
          // Check if pricing item id exists and find catalog price
          const catalogSellPrice = item.pricing_item_id ? catMap[item.pricing_item_id] : null;
          const currentSellPrice = Number(item.unit_price) || 0;

          return {
            line_number: index + 1,
            pricing_item_id: item.pricing_item_id || null,
            item_code: item.item_code || item.code || '',
            description: item.name || item.description || '',
            system: item.system || 'ELV',
            category: item.category || 'General',
            unit: item.unit || 'EA',
            quantity: Number(item.quantity) || 1,
            unit_sell_price: currentSellPrice,
            discount_pct: 0,
            unit_sell_price_after_discount: currentSellPrice,
            line_total: Number(item.total_price) || (Number(item.quantity) * currentSellPrice),
            vat_applicable: true,
            is_optional: false,
            notes: '',
            catalog_price: catalogSellPrice // cache catalog price for price variance check
          };
        });

        setQuoteLines(mappedLines);

        // Populate quote header fields
        setQuoteHeader((prev: any) => ({
          ...prev,
          project_ref: tender?.id ? `DSC-${currentYear}-${tender.id.slice(0, 4).toUpperCase()}` : `DSC-${currentYear}-001`,
          subject: tender?.title ? `${tender.title} ELV System Installation` : '',
          client_name: tender?.client_name || '',
          scope_summary: tender?.scope_of_work || ''
        }));

        // Seed templates
        if (templates && templates.length > 0) {
          const paymentTpl = templates.find((t: any) => t.template_type === 'PAYMENT');
          const warrantyTpl = templates.find((t: any) => t.template_type === 'WARRANTY');
          const termsTpl = templates.find((t: any) => t.template_type === 'TERMS');
          const exclusionsTpl = templates.find((t: any) => t.template_type === 'EXCLUSIONS');
          const inclusionsTpl = templates.find((t: any) => t.template_type === 'INCLUSIONS');

          setQuoteHeader((prev: any) => ({
            ...prev,
            payment_terms: paymentTpl?.content || '',
            warranty_terms: warrantyTpl?.content || '',
            terms_and_conditions: termsTpl?.content || '',
            exclusions: exclusionsTpl?.content || '',
            inclusions: inclusionsTpl?.content || ''
          }));
        }

      } catch (err: any) {
        console.error('Error loading page details:', err);
        setErrorMsg(err.message || 'Failed to initialize details from BOQ');
      } finally {
        setLoading(false);
      }
    };

    loadBOQData();
  }, [boqId, templates]);

  // Handle client selection
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

  // Add a new client
  const handleAddNewClient = async () => {
    if (!quoteHeader.client_name) return;
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          name: quoteHeader.client_name,
          address_line1: quoteHeader.client_address_line1,
          address_line2: quoteHeader.client_address_line2,
          city: quoteHeader.client_city,
          country: quoteHeader.client_country,
          contact_person: quoteHeader.client_contact_person,
          contact_email: quoteHeader.client_contact_email,
          contact_phone: quoteHeader.client_contact_phone
        })
        .select()
        .single();
      
      if (error) throw error;
      setClients(prev => [...prev, data]);
      setQuoteHeader((prev: any) => ({ ...prev, client_id: data.id }));
      alert('Client successfully created and linked!');
    } catch (e: any) {
      alert('Error creating client: ' + e.message);
    }
  };

  // Handle header field updates
  const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setQuoteHeader((prev: any) => ({ ...prev, [name]: value }));
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

  // Load a clause from library
  const loadClauseTemplate = (type: string) => {
    const matched = templates.filter(t => t.template_type === type);
    if (matched.length === 0) {
      alert(`No templates found for type ${type}`);
      return;
    }
    const tpl = matched[0]; // Load first match
    setQuoteHeader((prev: any) => ({
      ...prev,
      [type === 'PAYMENT' ? 'payment_terms' : 
       type === 'WARRANTY' ? 'warranty_terms' : 
       type === 'TERMS' ? 'terms_and_conditions' : 
       type === 'EXCLUSIONS' ? 'exclusions' : 'inclusions']: tpl.content
    }));
  };

  // Handle line changes
  const handleLineChange = (index: number, field: string, value: any) => {
    const updated = [...quoteLines];
    const line = { ...updated[index] };
    
    line[field] = value;
    
    // Auto-calculate line totals
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
    
    // Re-index line numbers
    const reindexed = updated.map((l, idx) => ({ ...l, line_number: idx + 1 }));
    setQuoteLines(reindexed);
  };

  // Submit quotation to database
  const handleSubmitQuotation = async () => {
    if (!quoteHeader.client_name || !quoteHeader.subject) {
      alert('Please fill Client details and Quotation Subject before saving.');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg('');

      // Create new client row if not linked
      let finalClientId = quoteHeader.client_id;
      if (!finalClientId) {
        // Automatically insert the client
        const { data: cl, error: clErr } = await supabase
          .from('clients')
          .insert({
            name: quoteHeader.client_name,
            address_line1: quoteHeader.client_address_line1,
            address_line2: quoteHeader.client_address_line2,
            city: quoteHeader.client_city,
            country: quoteHeader.client_country,
            contact_person: quoteHeader.client_contact_person,
            contact_email: quoteHeader.client_contact_email,
            contact_phone: quoteHeader.client_contact_phone
          })
          .select()
          .single();
        if (clErr) throw clErr;
        finalClientId = cl.id;
      }

      const res = await quotationService.createFromBOQ(boqId, {
        ...quoteHeader,
        client_id: finalClientId,
        lines: quoteLines
      });

      // Navigate to quotation detail page
      router.push(`/quotations/${res.id}`);
    } catch (err: any) {
      // Supabase/Postgrest errors don't serialize via the default console.error
      // (they log as "{}"); surface message/details/hint/code explicitly.
      const detail = err?.message || err?.details || err?.hint || err?.code || 'Unknown error';
      console.error('Error saving quotation:', {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
      });
      setErrorMsg(`Failed to save quotation: ${detail}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="quote-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading BOQ pricing details...</p>
      </div>
    );
  }

  if (errorMsg && step === 1) {
    return (
      <div className="quote-container">
        <div className="quote-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)', textAlign: 'center', padding: '3rem' }}>
          <AlertCircle size={48} style={{ color: '#ef4444', margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', marginBottom: '1rem' }}>Initialization Error</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{errorMsg}</p>
          <Link href="/quotations" className="quote-btn quote-btn-secondary">
            <ArrowLeft size={14} /> Back to Registry
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
          <Link href="/quotations" className="quote-btn quote-btn-secondary" style={{ padding: '0.4rem 0.6rem' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="quote-header-title">Create Quotation from BOQ</h1>
            <p className="quote-header-subtitle">Step {step} of 4: {step === 1 ? 'Client & Header Details' : step === 2 ? 'Line Items & Pricing' : step === 3 ? 'Commercial Clauses' : 'Preview & Submit'}</p>
          </div>
        </div>
      </header>

      {/* Wizard Progress Steps Indicator */}
      <div className="quote-card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {['Details', 'Line Items', 'Commercial Terms', 'Review'].map((label, idx) => (
            <div 
              key={label} 
              style={{ 
                flex: 1, 
                textAlign: 'center', 
                borderBottom: `2px solid ${step > idx + 1 ? 'var(--success)' : step === idx + 1 ? 'var(--accent)' : 'var(--surface-hover)'}`,
                paddingBottom: '0.5rem',
                color: step === idx + 1 ? 'var(--accent)' : step > idx + 1 ? 'var(--success)' : 'var(--text-muted)',
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

      {/* STEP 1: CLIENT & HEADER DETAILS */}
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
              <input type="text" name="tender_ref" className="quote-form-input" placeholder="Tender ID (if applicable)" value={quoteHeader.tender_ref} onChange={handleHeaderChange} />
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

          <div style={{ borderTop: '1px solid var(--surface-hover)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Client Search & Profile</h4>
            
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
                <label>Client Name (Editable Snapshot)</label>
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

            <div className="quote-form-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="quote-form-group">
                <label>Contact Email</label>
                <input type="email" name="client_contact_email" className="quote-form-input" value={quoteHeader.client_contact_email || ''} onChange={handleHeaderChange} />
              </div>
              <div className="quote-form-group">
                <label>Contact Phone</label>
                <input type="text" name="client_contact_phone" className="quote-form-input" value={quoteHeader.client_contact_phone || ''} onChange={handleHeaderChange} />
              </div>
              <div className="quote-form-group" style={{ justifyContent: 'flex-end' }}>
                {!quoteHeader.client_id && quoteHeader.client_name && (
                  <button type="button" className="quote-btn quote-btn-secondary" style={{ width: 'fit-content' }} onClick={handleAddNewClient}>
                    Save Client to Master
                  </button>
                )}
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--surface-hover)', paddingTop: '1.5rem' }}>
            <div className="quote-form-group" style={{ marginBottom: '1.2rem' }}>
              <label>Quotation Subject</label>
              <input type="text" name="subject" className="quote-form-input" placeholder="e.g. CCTV & Access Control System — Villa 42, Palm Jumeirah" value={quoteHeader.subject} onChange={handleHeaderChange} />
            </div>
            <div className="quote-form-group">
              <label>Scope of Work (Paragraph appearing on PDF cover)</label>
              <textarea name="scope_summary" className="quote-form-textarea" style={{ minHeight: '120px' }} placeholder="Detail the ELV system scope..." value={quoteHeader.scope_summary} onChange={handleHeaderChange} />
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: LINE ITEMS & CALCULATOR */}
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
                {quoteLines.map((line: any, index: number) => {
                  // Variance warning badge
                  const hasPriceChanged = line.catalog_price !== null && line.catalog_price !== line.unit_sell_price;
                  const deltaPercent = hasPriceChanged ? ((line.unit_sell_price - line.catalog_price!) / line.catalog_price!) * 100 : 0;

                  return (
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
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <input 
                            type="number" 
                            className="quote-filter-input" 
                            style={{ padding: '0.3rem', width: '100%', textAlign: 'right', fontSize: '0.8rem' }} 
                            value={line.unit_sell_price} 
                            onChange={(e) => handleLineChange(index, 'unit_sell_price', parseFloat(e.target.value) || 0)} 
                          />
                          {hasPriceChanged && (
                            <span 
                              style={{ 
                                fontSize: '0.62rem', 
                                padding: '1px 4px', 
                                borderRadius: '4px', 
                                marginTop: '2px', 
                                background: deltaPercent > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', 
                                color: deltaPercent > 0 ? '#10b981' : '#ef4444',
                                border: `1px solid ${deltaPercent > 0 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
                              }}
                            >
                              {deltaPercent > 0 ? '+' : ''}{deltaPercent.toFixed(1)}% vs Catalog
                            </span>
                          )}
                        </div>
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
                  );
                })}
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

      {/* STEP 3: COMMERCIAL CLAUSES */}
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
                  Load Template ↗
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
                  Load Template ↗
                </button>
              </div>
              <textarea name="warranty_terms" className="quote-form-textarea" value={quoteHeader.warranty_terms} onChange={handleHeaderChange} />
            </div>

            <div className="quote-form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Terms & Conditions</label>
                <button type="button" className="quote-btn quote-btn-secondary" style={{ padding: '2px 8px', fontSize: '0.72rem' }} onClick={() => loadClauseTemplate('TERMS')}>
                  Load Template ↗
                </button>
              </div>
              <textarea name="terms_and_conditions" className="quote-form-textarea" style={{ minHeight: '140px' }} value={quoteHeader.terms_and_conditions} onChange={handleHeaderChange} />
            </div>

            <div className="quote-form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Inclusions</label>
                <button type="button" className="quote-btn quote-btn-secondary" style={{ padding: '2px 8px', fontSize: '0.72rem' }} onClick={() => loadClauseTemplate('INCLUSIONS')}>
                  Load Template ↗
                </button>
              </div>
              <textarea name="inclusions" className="quote-form-textarea" style={{ minHeight: '120px' }} value={quoteHeader.inclusions} onChange={handleHeaderChange} />
            </div>

            <div className="quote-form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Exclusions</label>
                <button type="button" className="quote-btn quote-btn-secondary" style={{ padding: '2px 8px', fontSize: '0.72rem' }} onClick={() => loadClauseTemplate('EXCLUSIONS')}>
                  Load Template ↗
                </button>
              </div>
              <textarea name="exclusions" className="quote-form-textarea" style={{ minHeight: '120px' }} value={quoteHeader.exclusions} onChange={handleHeaderChange} />
            </div>

            <div className="quote-form-grid">
              <div className="quote-form-group">
                <label>Client Notes (Shown on PDF footer)</label>
                <textarea name="notes_client" className="quote-form-textarea" value={quoteHeader.notes_client} onChange={handleHeaderChange} />
              </div>
              <div className="quote-form-group">
                <label>Internal Notes (NOT shown on PDF)</label>
                <textarea name="notes_internal" className="quote-form-textarea" value={quoteHeader.notes_internal} onChange={handleHeaderChange} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: PREVIEW & SUBMIT */}
      {step === 4 && (
        <div className="quote-card">
          <div className="quote-card-header">
            <h3 className="quote-card-title"><CheckCircle size={18} /> Review Quotation Details</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header info */}
            <div>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--accent)', marginBottom: '0.5rem' }}>Header Information</h4>
              <p><strong>Subject:</strong> {quoteHeader.subject}</p>
              <p><strong>Client Name:</strong> {quoteHeader.client_name}</p>
              <p><strong>Project Ref:</strong> {quoteHeader.project_ref}</p>
              <p><strong>Date:</strong> {new Date(quoteHeader.quotation_date).toLocaleDateString('en-GB')} (Valid until {new Date(quoteHeader.valid_until).toLocaleDateString('en-GB')})</p>
            </div>

            {/* Financial Summary */}
            <div style={{ borderTop: '1px solid var(--surface-hover)', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--accent)', marginBottom: '0.5rem' }}>Financial Totals</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: '400px' }}>
                <div>Subtotal Excl. VAT:</div>
                <div style={{ fontWeight: 600 }}>{fmtAED(subtotal)}</div>
                {discount > 0 && (
                  <>
                    <div>Discount Amount:</div>
                    <div style={{ color: '#ef4444' }}>-{fmtAED(discount)}</div>
                  </>
                )}
                <div>VAT Amount (5%):</div>
                <div>{fmtAED(vat)}</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Grand Total:</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent)' }}>{fmtAED(grandTotal)}</div>
              </div>
            </div>

            {/* Clause Previews */}
            <div style={{ borderTop: '1px solid var(--surface-hover)', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--accent)', marginBottom: '0.5rem' }}>Terms Preview</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}><strong>Payment:</strong> {quoteHeader.payment_terms || 'None'}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}><strong>Warranty:</strong> {quoteHeader.warranty_terms || 'None'}</p>
            </div>

            <div style={{ borderTop: '1px solid var(--surface-hover)', paddingTop: '1rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>Click below to create this quotation. It will be saved as DRAFT status, allowing you to edit or submit for review.</p>
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
            onClick={handleSubmitQuotation}
          >
            {saving ? 'Creating Quotation...' : 'Create & Save Quotation'}
          </button>
        )}
      </footer>
    </div>
  );
}
