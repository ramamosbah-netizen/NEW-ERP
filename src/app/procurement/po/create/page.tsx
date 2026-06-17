// ============================================================
// JEET ERP — Create Manual Purchase Order (LPO) Page
// Route: /procurement/po/create
// ============================================================

'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { poService } from '@/services/poService';
import { poFromComparisonService, POProposal } from '@/services/poFromComparisonService';
import { ALL_PO_TYPES, PO_TYPE_LABELS } from '@/constants/po.constants';
import { Plus, Trash, ArrowLeft, Save, AlertCircle, RefreshCw, Scale, Download } from 'lucide-react';
import '@/app/procurement/comparisons/comparisons.css';

const DEFAULT_ITEM = {
  description: '',
  brand: '',
  unit: 'Pcs',
  quantity: 1,
  unit_price: 0,
  discount_pct: 0,
  vat_applicable: true,
  system: 'CCTV'
};

const ELV_SYSTEMS = [
  { value: 'CCTV', label: 'CCTV & Surveillance' },
  { value: 'ACCESS_CONTROL', label: 'Access Control' },
  { value: 'FIRE_ALARM', label: 'Fire Alarm' },
  { value: 'BMS', label: 'BMS (Building Management)' },
  { value: 'STRUCTURED_CABLING', label: 'Structured Cabling' },
  { value: 'PA_AV_BGM', label: 'PA / AV / BGM' },
  { value: 'GATE_BARRIER', label: 'Gate Barrier' },
  { value: 'KNX_SMART_HOME', label: 'KNX / Smart Home' },
  { value: 'ELECTRICAL', label: 'Electrical' },
  { value: 'OTHER', label: 'Other / Consumables' }
];

export default function CreatePOPage() {
  return (
    <Suspense fallback={
      <div className="comp-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading LPO editor...</p>
        </div>
      </div>
    }>
      <POFormContent />
    </Suspense>
  );
}

function POFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const poIdParam = searchParams.get('po_id');
  const reviseIdParam = searchParams.get('revise_id');
  const prIdParam = searchParams.get('pr_id');

  // Load Lists
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  // PO Header Form State
  const [poType, setPoType] = useState<string>('PROJECT_MATERIAL');
  const [supplierId, setSupplierId] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [promisedDeliveryDays, setPromisedDeliveryDays] = useState<number>(7);
  const [requiredDeliveryDate, setRequiredDeliveryDate] = useState<string>('');
  const [paymentTermsDays, setPaymentTermsDays] = useState<number>(30);
  const [paymentTermsText, setPaymentTermsText] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('BANK_TRANSFER');
  const [comparisonThreshold, setComparisonThreshold] = useState<number>(10000);
  const [noComparisonJustification, setNoComparisonJustification] = useState<string>('');
  const [termsConditions, setTermsConditions] = useState<string>('');
  const [notesToSupplier, setNotesToSupplier] = useState<string>('');
  const [internalNotes, setInternalNotes] = useState<string>('');

  // PO Items list state
  const [items, setItems] = useState<any[]>([{ ...DEFAULT_ITEM }]);

  // Calculations State
  const [totals, setTotals] = useState({
    subtotal: 0,
    discount_amount: 0,
    vat_amount: 0,
    total: 0
  });

  const [saving, setSaving] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);

  // Fetch initial option lists and load LPO if editing/revising
  useEffect(() => {
    async function loadOptionsAndLPO() {
      try {
        setLoadingLists(true);
        const [supRes, projRes] = await Promise.all([
          supabase.from('pricing_suppliers').select('*').eq('is_active', true).order('name', { ascending: true }),
          supabase.from('projects').select('*').eq('is_active', true).order('project_number', { ascending: true })
        ]);

        if (supRes.data) setSuppliers(supRes.data);
        if (projRes.data) setProjects(projRes.data);

        // Configurable comparison/direct-purchase threshold (Admin → Settings)
        try {
          const { default: settingsService } = await import('@/services/settingsService');
          const t = await settingsService.getSettingByKey<number>('procurement.direct_purchase_threshold', 10000);
          setComparisonThreshold(Number(t) || 10000);
        } catch { /* keep default */ }

        // Load existing PO details if editing a draft or completing a revision
        const targetPoId = poIdParam || reviseIdParam;
        if (targetPoId) {
          const po = await poService.getPODetail(targetPoId);
          setPoType(po.po_type);
          setSupplierId(po.supplier_id);
          setProjectId(po.project_id || '');
          setDeliveryAddress(po.delivery_address || '');
          setPromisedDeliveryDays(po.promised_delivery_days || 7);
          setRequiredDeliveryDate(po.required_delivery_date || '');
          setPaymentTermsDays(po.payment_terms_days || 30);
          setPaymentTermsText(po.payment_terms_text || '');
          setNoComparisonJustification(po.no_comparison_justification || '');
          setTermsConditions(po.terms_conditions || '');
          setNotesToSupplier(po.notes_to_supplier || '');
          setInternalNotes(po.internal_notes || '');
          if (po.items && po.items.length > 0) {
            setItems(po.items.map(it => ({
              description: it.description,
              brand: it.brand || '',
              unit: it.unit,
              quantity: it.quantity,
              unit_price: it.unit_price,
              discount_pct: it.discount_pct,
              vat_applicable: it.vat_applicable,
              system: it.system || 'CCTV'
            })));
          }
        }

        // Pre-fill from an approved Purchase Request (convert PR -> LPO)
        if (prIdParam && !targetPoId) {
          const { prService } = await import('@/services/prService');
          const pr = await prService.get(prIdParam);
          // Category mapping: non-project PR categories become OVERHEAD POs
          setPoType(pr.project_id ? 'PROJECT_MATERIAL' : 'OVERHEAD');
          if (pr.project_id) setProjectId(pr.project_id);
          if (pr.preferred_supplier_id) {
            const sup = (supRes.data || []).find((s: any) => s.id === pr.preferred_supplier_id);
            if (sup) { setSupplierId(sup.id); setPaymentTermsDays(sup.payment_terms_days || 30); setPaymentTermsText(`${sup.payment_terms_days || 30} Days Net`); }
          }
          setInternalNotes(`Converted from Purchase Request ${pr.pr_number}`);
          setNoComparisonJustification(`Sourced via approved Purchase Request ${pr.pr_number}`);
          if (pr.items?.length) {
            setItems(pr.items.map((it: any) => ({
              description: it.description,
              brand: it.brand || '',
              unit: it.unit || 'Pcs',
              quantity: Number(it.quantity) || 1,
              unit_price: Number(it.estimated_unit_cost) || 0,
              discount_pct: 0,
              vat_applicable: true,
              system: it.system || 'OTHER',
            })));
          }
        }
      } catch (err) {
        logger.error('Failed to load form data or LPO draft:', err);
      } finally {
        setLoadingLists(false);
      }
    }

    loadOptionsAndLPO();
  }, [poIdParam, reviseIdParam, prIdParam]);

  // Set default values when supplier is selected
  const handleSupplierChange = (supId: string) => {
    setSupplierId(supId);
    const selected = suppliers.find(s => s.id === supId);
    if (selected) {
      setPaymentTermsDays(selected.payment_terms_days || 30);
      setPaymentTermsText(`${selected.payment_terms_days || 30} Days Net`);
    }
  };

  // Auto-import from approved comparison when a project is selected
  const [comparisonProposals, setComparisonProposals] = useState<POProposal[]>([]);
  const [comparisonId, setComparisonId] = useState<string | null>(null);
  const [importSupplierId, setImportSupplierId] = useState<string>('');

  useEffect(() => {
    if (!projectId) { setComparisonProposals([]); setComparisonId(null); return; }
    let cancelled = false;
    poFromComparisonService.getProposalsForProject(projectId)
      .then(({ comparisonId, proposals }) => {
        if (cancelled) return;
        setComparisonId(comparisonId);
        setComparisonProposals(proposals);
        setImportSupplierId(proposals[0]?.supplier_id || '');
      })
      .catch(() => { if (!cancelled) { setComparisonProposals([]); setComparisonId(null); } });
    return () => { cancelled = true; };
  }, [projectId]);

  const handleImportFromComparison = () => {
    const proposal = comparisonProposals.find(p => p.supplier_id === importSupplierId);
    if (!proposal) return;
    // Supplier
    if (suppliers.some(s => s.id === proposal.supplier_id)) {
      handleSupplierChange(proposal.supplier_id);
    }
    // Items
    setItems(proposal.items.map(it => ({
      description: it.description,
      brand: it.brand || '',
      unit: it.unit || 'Pcs',
      quantity: it.quantity,
      unit_price: it.unit_price,
      discount_pct: 0,
      vat_applicable: it.vat_applicable ?? true,
      system: it.system || 'OTHER',
      comparison_item_id: it.comparison_item_id,
    })));
    if (proposal.payment_terms_days) {
      setPaymentTermsDays(proposal.payment_terms_days);
      setPaymentTermsText(`${proposal.payment_terms_days} Days Net`);
    }
  };

  // Recompute Totals on item change
  useEffect(() => {
    let subtotal = 0;
    let discountTotal = 0;
    let vatTotal = 0;

    items.forEach(it => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.unit_price) || 0;
      const discPct = Number(it.discount_pct) || 0;
      
      const lineBase = qty * price;
      const lineDisc = lineBase * (discPct / 100);
      const lineSubtotal = lineBase - lineDisc;
      
      subtotal += lineBase;
      discountTotal += lineDisc;
      
      if (it.vat_applicable) {
        // Standard 5% VAT rate
        vatTotal += lineSubtotal * 0.05;
      }
    });

    const grandTotal = subtotal - discountTotal + vatTotal;

    setTotals({
      subtotal: Number(subtotal.toFixed(2)),
      discount_amount: Number(discountTotal.toFixed(2)),
      vat_amount: Number(vatTotal.toFixed(2)),
      total: Number(grandTotal.toFixed(2))
    });
  }, [items]);

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const addItemRow = () => {
    setItems(prev => [...prev, { ...DEFAULT_ITEM }]);
  };

  const removeItemRow = (index: number) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Handle Save
  const handleSavePO = async () => {
    try {
      setSaving(true);
      setErrorMessages([]);

      // 1. Gather Selected Supplier metadata
      const selectedSup = suppliers.find(s => s.id === supplierId);
      if (!selectedSup) {
        setErrorMessages(['Please select a valid supplier.']);
        setSaving(false);
        return;
      }

      const targetPoId = poIdParam || reviseIdParam;

      // 2. Perform validations
      const poHeader: any = {
        project_id: poType === 'OVERHEAD' ? null : projectId,
        po_type: poType,
        supplier_id: supplierId,
        supplier_name: selectedSup.name,
        supplier_trn: selectedSup.trn || null,
        supplier_contact: selectedSup.contact_person || null,
        supplier_email: selectedSup.email || null,
        supplier_phone: selectedSup.phone || null,
        delivery_address: deliveryAddress || null,
        required_delivery_date: requiredDeliveryDate || null,
        promised_delivery_days: promisedDeliveryDays || null,
        payment_terms_days: paymentTermsDays,
        payment_terms_text: paymentTermsText || `${paymentTermsDays} Days Net`,
        payment_method: paymentMethod || null,
        subtotal: totals.subtotal,
        discount_amount: totals.discount_amount,
        vat_amount: totals.vat_amount,
        total: totals.total,
        no_comparison_justification: noComparisonJustification || null,
        terms_conditions: termsConditions || null,
        notes_to_supplier: notesToSupplier || null,
        internal_notes: internalNotes || null,
      };

      if (!targetPoId) {
        poHeader.origin = 'MANUAL';
        if (prIdParam) poHeader.pr_id = prIdParam;
      }

      // Validate threshold constraint
      const errors = [];
      if (totals.total > comparisonThreshold && poType !== 'OVERHEAD' && (!noComparisonJustification || noComparisonJustification.trim() === '')) {
        errors.push(`Justification Required: Manual LPOs exceeding ${comparisonThreshold.toLocaleString()} AED must specify why a comparison sheet was not generated.`);
      }
      if (poType !== 'OVERHEAD' && !projectId) {
        errors.push('Please select a project.');
      }
      if (items.some(it => !it.description || it.description.trim() === '')) {
        errors.push('All item rows must contain a description.');
      }
      if (items.some(it => Number(it.quantity) <= 0 || Number(it.unit_price) < 0)) {
        errors.push('Quantity must be greater than 0 and Unit Price cannot be negative.');
      }

      if (errors.length > 0) {
        setErrorMessages(errors);
        setSaving(false);
        return;
      }

      // 3. Save via poService
      const formattedItems = items.map(it => ({
        description: it.description,
        brand: it.brand || null,
        unit: it.unit,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        discount_pct: Number(it.discount_pct) || 0,
        vat_applicable: it.vat_applicable,
        line_total: Number((Number(it.quantity) * Number(it.unit_price) * (1 - (Number(it.discount_pct) || 0)/100)).toFixed(2)),
        system: it.system,
        notes: null
      }));

      const newPoId = targetPoId
        ? await poService.updatePO(targetPoId, poHeader, formattedItems).then(() => targetPoId)
        : await poService.createPO(poHeader, formattedItems);

      // If this LPO was converted from a Purchase Request, mark the PR converted
      if (prIdParam && !targetPoId && newPoId) {
        try {
          const { prService } = await import('@/services/prService');
          await prService.markConverted(prIdParam, newPoId as string);
        } catch (e) {
          logger.warn('Could not mark PR as converted:', e);
        }
      }

      router.push(`/procurement/po/${newPoId}`);

    } catch (err: any) {
      logger.error('Failed to create PO:', err);
      setErrorMessages([err.message || 'An error occurred while saving the Purchase Order.']);
    } finally {
      setSaving(false);
    }
  };

  const isJustificationRequired = totals.total > comparisonThreshold && poType !== 'OVERHEAD';

  return (
    <div className="comp-container">
      {/* Header */}
      <header className="comp-header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/procurement/po" className="quote-btn quote-btn-secondary" style={{ padding: '0.5rem' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="comp-header-title">
              {poIdParam ? 'Edit Draft Purchase Order' : reviseIdParam ? 'Complete LPO Revision' : 'Create Manual Local Purchase Order'}
            </h1>
            <p className="comp-header-subtitle">
              {poIdParam ? 'Update and refine draft details for LPO' : reviseIdParam ? 'Commit revised quantities and terms for LPO' : 'Build, draft, and route direct procurement commitments'}
            </p>
          </div>
        </div>
        
        <button 
          className="quote-btn quote-btn-primary" 
          onClick={handleSavePO}
          disabled={saving || loadingLists}
        >
          {saving ? <RefreshCw size={16} className="spinner" /> : <Save size={16} />} Save Draft LPO
        </button>
      </header>

      {/* Validation Errors */}
      {errorMessages.length > 0 && (
        <div className="quote-card" style={{ borderLeft: '4px solid var(--error)', background: 'rgba(239, 68, 68, 0.05)', padding: '1.2rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
            <AlertCircle size={18} style={{ color: 'var(--error)', flexShrink: 0, marginTop: '0.1rem' }} />
            <div>
              <h4 style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.4rem' }}>Validation Flags Raised</h4>
              <ul style={{ paddingLeft: '1.2rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {errorMessages.map((err, i) => <li key={i} style={{ marginBottom: '0.2rem' }}>{err}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      {loadingLists ? (
        <div className="quote-card" style={{ padding: '4rem', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading catalog options...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Header Configuration Card */}
          <div className="quote-card">
            <h3 className="quote-card-title" style={{ marginBottom: '1.2rem' }}>PO Header Details</h3>
            
            <div className="quote-form-grid">
              <div className="quote-form-group">
                <label>PO Classification Type</label>
                <select 
                  className="quote-form-input" 
                  value={poType}
                  onChange={(e) => {
                    setPoType(e.target.value);
                    if (e.target.value === 'OVERHEAD') setProjectId('');
                  }}
                >
                  {ALL_PO_TYPES.map(type => (
                    <option key={type} value={type}>{PO_TYPE_LABELS[type]}</option>
                  ))}
                </select>
              </div>

              <div className="quote-form-group">
                <label>Select Supplier</label>
                <select 
                  className="quote-form-input" 
                  value={supplierId}
                  onChange={(e) => handleSupplierChange(e.target.value)}
                >
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map(sup => (
                    <option key={sup.id} value={sup.id}>{sup.name}</option>
                  ))}
                </select>
              </div>

              <div className="quote-form-group">
                <label>Project Coordinate</label>
                <select 
                  className="quote-form-input" 
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={poType === 'OVERHEAD'}
                >
                  <option value="">-- Choose Project --</option>
                  {projects.map(proj => (
                    <option key={proj.id} value={proj.id}>{proj.project_number} - {proj.name}</option>
                  ))}
                </select>
              </div>

              <div className="quote-form-group">
                <label>Delivery Date Requirement</label>
                <input 
                  type="date" 
                  className="quote-form-input" 
                  value={requiredDeliveryDate}
                  onChange={(e) => setRequiredDeliveryDate(e.target.value)}
                />
              </div>
            </div>

            <div className="quote-form-grid" style={{ marginTop: '1.2rem' }}>
              <div className="quote-form-group">
                <label>Promised Days (from LPO)</label>
                <input 
                  type="number" 
                  className="quote-form-input" 
                  value={promisedDeliveryDays}
                  onChange={(e) => setPromisedDeliveryDays(Number(e.target.value) || 0)}
                />
              </div>

              <div className="quote-form-group">
                <label>Payment Terms Days</label>
                <input
                  type="number"
                  className="quote-form-input"
                  value={paymentTermsDays}
                  onChange={(e) => {
                    setPaymentTermsDays(Number(e.target.value) || 0);
                    setPaymentTermsText(`${e.target.value} Days Net`);
                  }}
                />
              </div>

              <div className="quote-form-group">
                <label>Mode of Payment</label>
                <select className="quote-form-input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                  <option value="CREDIT">Credit (on account)</option>
                  <option value="PETTY_CASH">Petty Cash</option>
                  <option value="LC">Letter of Credit</option>
                </select>
              </div>

              <div className="quote-form-group" style={{ gridColumn: 'span 2' }}>
                <label>Delivery Site Address</label>
                <input 
                  type="text" 
                  className="quote-form-input" 
                  placeholder="Address details for materials offloading"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Justification check */}
          {isJustificationRequired && (
            <div className="quote-card" style={{ border: '1px solid rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.03)' }}>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                <AlertCircle size={18} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '0.1rem' }} />
                <div style={{ width: '100%' }}>
                  <h4 style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.4rem' }}>Justification Required for Manual LPO</h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
                    Since the total value of this manual LPO exceeds 10,000 AED and is linked to a project, you must provide a justification statement detailing why a supplier comparison sheet was bypassed.
                  </p>
                  <textarea
                    className="quote-filter-input"
                    style={{ width: '100%', minHeight: '60px', padding: '0.6rem', resize: 'vertical' }}
                    placeholder="Provide justification statement (ex: Sole distributor of specialized equipment / Client instruction / Urgent emergency site purchase...)"
                    value={noComparisonJustification}
                    onChange={(e) => setNoComparisonJustification(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Import-from-comparison banner (when the selected project has a comparison) */}
          {comparisonProposals.length > 0 && (
            <div className="quote-card" style={{ border: '1px solid rgba(0, 229, 160, 0.3)', background: 'rgba(0, 229, 160, 0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
                <Scale size={18} style={{ color: 'var(--secondary, var(--accent))', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Comparison sheet found for this project</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Import the selected supplier&apos;s items, prices and terms directly from the comparison.
                  </div>
                </div>
                <select
                  className="quote-form-input"
                  style={{ maxWidth: '260px' }}
                  value={importSupplierId}
                  onChange={(e) => setImportSupplierId(e.target.value)}
                >
                  {comparisonProposals.map(p => (
                    <option key={p.supplier_id} value={p.supplier_id}>
                      {p.supplier_name} — {p.items.length} item(s), {new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(p.total)} AED
                    </option>
                  ))}
                </select>
                <button type="button" className="quote-btn quote-btn-primary" onClick={handleImportFromComparison} disabled={!importSupplierId}>
                  <Download size={14} style={{ marginRight: '0.3rem' }} /> Import
                </button>
              </div>
            </div>
          )}

          {/* Items Entry Grid */}
          <div className="quote-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="quote-card-title">PO Line Items</h3>
              <button className="quote-btn quote-btn-secondary" style={{ padding: '0.4rem 0.8rem' }} onClick={addItemRow}>
                <Plus size={14} style={{ marginRight: '0.2rem' }} /> Add Row
              </button>
            </div>

            <div className="quote-table-wrap">
              <table className="quote-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>Line</th>
                    <th>Item Description *</th>
                    <th style={{ width: '120px' }}>Brand / Maker</th>
                    <th style={{ width: '90px' }}>Unit</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Qty</th>
                    <th style={{ width: '110px', textAlign: 'right' }}>Price (AED)</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Discount %</th>
                    <th style={{ width: '140px' }}>Subsystem</th>
                    <th style={{ width: '70px', textAlign: 'center' }}>VAT</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Total (AED)</th>
                    <th style={{ width: '50px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const lineTotal = (it.quantity || 0) * (it.unit_price || 0) * (1 - (it.discount_pct || 0) / 100);
                    
                    return (
                      <tr key={idx}>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                        <td>
                          <input 
                            type="text" 
                            className="quote-filter-input" 
                            style={{ width: '100%', padding: '0.3rem 0.5rem' }} 
                            placeholder="Material description"
                            value={it.description}
                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          />
                        </td>
                        <td>
                          <input 
                            type="text" 
                            className="quote-filter-input" 
                            style={{ width: '100%', padding: '0.3rem 0.5rem' }} 
                            placeholder="ex: Belden"
                            value={it.brand}
                            onChange={(e) => handleItemChange(idx, 'brand', e.target.value)}
                          />
                        </td>
                        <td>
                          <input 
                            type="text" 
                            className="quote-filter-input" 
                            style={{ width: '100%', padding: '0.3rem 0.5rem' }} 
                            placeholder="Pcs/Mtr"
                            value={it.unit}
                            onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            className="quote-filter-input" 
                            style={{ width: '100%', padding: '0.3rem 0.5rem', textAlign: 'right' }} 
                            value={it.quantity}
                            min="1"
                            onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value) || 0)}
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            className="quote-filter-input" 
                            style={{ width: '100%', padding: '0.3rem 0.5rem', textAlign: 'right' }} 
                            value={it.unit_price}
                            min="0"
                            step="0.01"
                            onChange={(e) => handleItemChange(idx, 'unit_price', Number(e.target.value) || 0)}
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            className="quote-filter-input" 
                            style={{ width: '100%', padding: '0.3rem 0.5rem', textAlign: 'right' }} 
                            value={it.discount_pct}
                            min="0"
                            max="100"
                            onChange={(e) => handleItemChange(idx, 'discount_pct', Number(e.target.value) || 0)}
                          />
                        </td>
                        <td>
                          <select 
                            className="quote-filter-input" 
                            style={{ width: '100%', padding: '0.3rem 0.5rem' }}
                            value={it.system}
                            onChange={(e) => handleItemChange(idx, 'system', e.target.value)}
                          >
                            {ELV_SYSTEMS.map(sys => (
                              <option key={sys.value} value={sys.value}>{sys.label}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={it.vat_applicable}
                            onChange={(e) => handleItemChange(idx, 'vat_applicable', e.target.checked)}
                          />
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                          {lineTotal.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            className="quote-btn" 
                            style={{ padding: '0.3rem', background: 'transparent', color: 'var(--error)' }}
                            onClick={() => removeItemRow(idx)}
                            disabled={items.length === 1}
                          >
                            <Trash size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Totals Summary */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{totals.subtotal.toFixed(2)} AED</span>
                </div>
                {totals.discount_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#ef4444' }}>
                    <span>Discount:</span>
                    <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>-{totals.discount_amount.toFixed(2)} AED</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>VAT (5.00%):</span>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{totals.vat_amount.toFixed(2)} AED</span>
                </div>
                <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)', margin: '0.2rem 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 700 }}>
                  <span style={{ color: 'var(--primary)' }}>Grand Total:</span>
                  <span style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{totals.total.toFixed(2)} AED</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes & Terms Card */}
          <div className="quote-card quote-form-grid">
            <div className="quote-form-group">
              <label>Terms & Conditions</label>
              <textarea 
                className="quote-form-textarea" 
                style={{ minHeight: '100px' }}
                placeholder="Standard terms and conditions of delivery..."
                value={termsConditions}
                onChange={(e) => setTermsConditions(e.target.value)}
              />
            </div>
            <div className="quote-form-group">
              <label>Notes to Supplier</label>
              <textarea 
                className="quote-form-textarea" 
                style={{ minHeight: '100px' }}
                placeholder="Printed instructions on the LPO sheet..."
                value={notesToSupplier}
                onChange={(e) => setNotesToSupplier(e.target.value)}
              />
            </div>
            <div className="quote-form-group">
              <label>Internal Audit Notes</label>
              <textarea 
                className="quote-form-textarea" 
                style={{ minHeight: '100px' }}
                placeholder="Private remarks for managers and accounts sign-off..."
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
