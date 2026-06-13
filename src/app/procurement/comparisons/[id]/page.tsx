// ============================================================
// JEET ERP — Supplier Comparison Sheet Matrix Grid
// Routes: /procurement/comparisons/:id
// ============================================================

'use client';

import { useState, useEffect, use, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  RefreshCw, 
  Download, 
  Trash2, 
  Plus, 
  CheckCircle, 
  AlertTriangle,
  Upload,
  Eye,
  Sliders,
  DollarSign,
  Briefcase,
  Layers,
  Sparkles,
  HelpCircle,
  FileSpreadsheet,
  FileText,
  Clock,
  Check,
  Pencil
} from 'lucide-react';
import { useComparison } from '@/hooks/useComparisons';
import { offerExtractionService, fuzzyMatchExtractedLine } from '@/lib/offer-extraction-service';
import { comparisonPDFService } from '@/lib/comparison-pdf';
import { comparisonExcelService } from '@/lib/comparison-excel';
import '../comparisons.css';

const fmtAED = (v: number) => {
  return 'AED ' + new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

export default function ComparisonMatrixPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  // Core comparison data hook
  const { comparison, loading, error, refetch, actions } = useComparison(id);
  const [currentProfile, setCurrentProfile] = useState<any>(null);

  // States
  const [filterMode, setFilterMode] = useState<string>('all'); // all, missing-3, overrides, non-compliant, critical-margin
  const [groupBySystem, setGroupBySystem] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Extraction Drawer State
  const [showDrawer, setShowDrawer] = useState<boolean>(false);
  const [drawerItem, setDrawerItem] = useState<any | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [extractedData, setExtractedData] = useState<any | null>(null);
  const [itemMappings, setItemMappings] = useState<Record<number, string>>({}); // maps index to comparisonItem.id

  // Manual Add Supplier Column State
  const [showAddSupplierModal, setShowAddSupplierModal] = useState<boolean>(false);
  const [newSupplierName, setNewSupplierName] = useState<string>('');
  const [registeredSuppliers, setRegisteredSuppliers] = useState<{ id: string; name: string }[]>([]);

  // Load registered suppliers from the supplier module for the picker
  const openAddSupplierModal = async () => {
    setNewSupplierName('');
    setShowAddSupplierModal(true);
    try {
      const { data } = await supabase
        .from('pricing_suppliers')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      setRegisteredSuppliers(data || []);
    } catch {
      setRegisteredSuppliers([]);
    }
  };

  // Local state for pricing cell edits to avoid DB keypress lag
  const [localEdits, setLocalEdits] = useState<Record<string, { 
    unit_price?: string; 
    delivery_days?: string; 
    payment_terms_days?: string; 
    is_compliant?: boolean;
  }>>({});

  // Use ':::' as separator to avoid collisions with UUID dashes and supplier name dashes
  const makeEditKey = (itemId: string, supplierName: string) => `${itemId}:::${supplierName}`;
  const parseEditKey = (editKey: string) => {
    const idx = editKey.indexOf(':::');
    return { itemId: editKey.substring(0, idx), supplierName: editKey.substring(idx + 3) };
  };

  const handleLocalChange = (itemId: string, supplierName: string, field: string, value: any) => {
    const editKey = makeEditKey(itemId, supplierName);
    setLocalEdits(prev => ({
      ...prev,
      [editKey]: {
        ...prev[editKey],
        [field]: value
      }
    }));
  };

  const handleSaveGrid = async () => {
    try {
      setActionLoading(true);
      const offersToSave: any[] = [];

      for (const editKey of Object.keys(localEdits)) {
        const { itemId, supplierName } = parseEditKey(editKey);
        const item = comparison.items.find((i: any) => i.id === itemId);
        if (!item) continue;

        const offer = (item.offers || []).find((o: any) => o.supplier_name === supplierName);
        const edit = localEdits[editKey];

        const unit_price = edit.unit_price !== undefined ? parseFloat(edit.unit_price) || 0 : (offer ? offer.unit_price : 0);
        const delivery_days = edit.delivery_days !== undefined ? edit.delivery_days : (offer ? offer.delivery_days : '');
        const payment_terms_days = edit.payment_terms_days !== undefined ? edit.payment_terms_days : (offer ? offer.payment_terms_days : 30);
        const is_compliant = edit.is_compliant !== undefined ? edit.is_compliant : (offer ? offer.is_compliant : true);

        offersToSave.push({
          ...(offer ? { id: offer.id } : {}),
          comparison_item_id: itemId,
          supplier_name: supplierName,
          unit_price,
          delivery_days,
          payment_terms_days,
          is_compliant
        });
      }

      if (offersToSave.length === 0) {
        alert('No changes to save.');
        return;
      }

      await actions.saveOffers(offersToSave);
      setLocalEdits({});
      alert('Grid changes saved and scores recomputed.');
    } catch (e: any) {
      alert('Failed to save grid changes: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDiscardChanges = () => {
    if (window.confirm('Discard all unsaved grid pricing edits?')) {
      setLocalEdits({});
    }
  };

  // Fetch current user details
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single()
          .then(({ data: profile }) => {
            if (profile) setCurrentProfile(profile);
          });
      }
    });
  }, []);

  if (loading) {
    return (
      <div className="comp-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading comparison sheet details...</p>
      </div>
    );
  }

  if (error || !comparison) {
    return (
      <div className="comp-container">
        <div className="quote-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)', textAlign: 'center', padding: '3rem' }}>
          <AlertTriangle size={48} style={{ color: '#ef4444', margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>Sheet Not Found</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Supplier comparison sheet details could not be loaded.</p>
          <Link href="/procurement/comparisons" className="quote-btn quote-btn-secondary" style={{ marginTop: '1.5rem' }}>
            Back to Registry
          </Link>
        </div>
      </div>
    );
  }

  // Get active roles
  const isProcurement = currentProfile?.role === 'engineer' || currentProfile?.role === 'admin';
  const isCommercial = currentProfile?.role === 'manager' || currentProfile?.role === 'admin';
  const isGM = currentProfile?.role === 'admin';

  // Format Status Label
  const statusLabels: Record<string, string> = {
    DRAFT: 'Draft',
    PRICING_IN_PROGRESS: 'Pricing in Progress',
    PENDING_COMMERCIAL: 'Pending Commercial Review',
    PENDING_GM: 'Pending GM Approval',
    APPROVED: 'Approved',
    REVISED: 'Revised',
    SUPERSEDED: 'Superseded',
    REJECTED: 'Rejected'
  };

  // ------------------------------------------------------------
  // SUPPLIERS MATRIX CALCULATIONS
  // ------------------------------------------------------------
  
  // Extract all unique supplier names present across all items
  const allSupplierNames = Array.from(
    new Set(
      comparison.items.flatMap((item: any) => 
        (item.offers || []).map((o: any) => o.supplier_name)
      )
    )
  ).sort() as string[];

  // Recalculate whole sheet
  const handleRecalculate = async () => {
    try {
      setActionLoading(true);
      await actions.recalculateAll();
      alert('Recalculate complete. Supplier ranks and scores updated.');
    } catch (e: any) {
      alert('Recalculate failed: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Auto select bulk recommended
  const handleAutoSelectBulk = async () => {
    if (window.confirm('Auto-select the best scored supplier (Rank 1) for all line items?')) {
      try {
        setActionLoading(true);
        await actions.bulkSelectRecommended();
        alert('All recommended suppliers selected.');
      } catch (e: any) {
        alert('Bulk selection failed: ' + e.message);
      } finally {
        setActionLoading(false);
      }
    }
  };

  // Submit sheet
  const handleSubmitSheet = async () => {
    try {
      setActionLoading(true);
      await actions.submitForReview();
      alert('Supplier comparison submitted for review!');
      router.push('/procurement/comparisons');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Re-open/Revision trigger
  const handleCreateRevision = async () => {
    if (window.confirm('Create a new comparison sheet revision? The current sheet will be marked as SUPERSEDED and locked.')) {
      try {
        setActionLoading(true);
        const newId = await actions.createRevision();
        alert('New revision created successfully.');
        router.push(`/procurement/comparisons/${newId}`);
      } catch (e: any) {
        alert('Failed to create revision: ' + e.message);
      } finally {
        setActionLoading(false);
      }
    }
  };

  // Export PDF
  const handleExportPDF = async () => {
    try {
      const blob = await comparisonPDFService.generate(comparison.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${comparison.comparison_number}_Rev${comparison.revision}_Comparison.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e: any) {
      alert('PDF generation failed: ' + e.message);
    }
  };

  // Export Excel
  const handleExportExcel = () => {
    try {
      comparisonExcelService.generate(comparison.id);
    } catch (e: any) {
      alert('Excel generation failed: ' + e.message);
    }
  };

  // Inline pricing edits
  const handleInlineOfferChange = async (itemId: string, supplierName: string, field: string, value: any) => {
    const item = comparison.items.find((i: any) => i.id === itemId);
    if (!item) return;

    const offer = (item.offers || []).find((o: any) => o.supplier_name === supplierName);
    
    if (offer) {
      // Update existing offer
      const updates: any = {};
      if (field === 'unit_price') updates.unit_price = parseFloat(value) || 0;
      if (field === 'delivery_days') updates.delivery_days = parseInt(value) || 0;
      if (field === 'payment_terms_days') updates.payment_terms_days = parseInt(value) || 30;
      if (field === 'is_compliant') updates.is_compliant = value === 'true';

      await actions.updateOffer(offer.id, updates);
    } else {
      // Create new offer
      const offerData: any = {
        supplier_name: supplierName,
        unit_price: field === 'unit_price' ? parseFloat(value) || 0 : 0,
        delivery_days: field === 'delivery_days' ? parseInt(value) || 7 : 7,
        payment_terms_days: field === 'payment_terms_days' ? parseInt(value) || 30 : 30,
        is_compliant: field === 'is_compliant' ? value === 'true' : true,
        offer_source: 'MANUAL'
      };
      await actions.addOffer(itemId, offerData);
    }
  };

  // Add Supplier Column manually
  const handleAddSupplierColumn = async () => {
    if (!newSupplierName.trim()) return;
    try {
      setActionLoading(true);
      setShowAddSupplierModal(false);
      const supplierName = newSupplierName.trim();

      // Check if supplier already exists in any item
      const alreadyExists = allSupplierNames.some(
        s => s.toLowerCase() === supplierName.toLowerCase()
      );
      if (alreadyExists) {
        alert(`Supplier '${supplierName}' already exists in the comparison grid.`);
        setActionLoading(false);
        return;
      }

      // Create a blank offer row for EVERY item so the full column appears
      const offersToInsert = comparison.items.map((item: any) => ({
        comparison_item_id: item.id,
        supplier_name: supplierName,
        unit_price: 0,
        delivery_days: null,
        payment_terms_days: 30,
        is_compliant: true
      }));

      await actions.saveOffers(offersToInsert);
      setNewSupplierName('');
      alert(`Supplier column '${supplierName}' added for all ${comparison.items.length} items.`);
    } catch (e: any) {
      alert('Failed to add supplier column: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Rename a supplier column (updates the name on every item's offer).
  // Only allowed while the comparison is unlocked.
  const handleRenameSupplier = async (oldName: string) => {
    if (comparison.is_locked) return;
    const input = window.prompt(`Rename supplier "${oldName}" to:`, oldName);
    if (input === null) return;
    const newName = input.trim();
    if (!newName || newName === oldName) return;

    if (allSupplierNames.some(s => s.toLowerCase() === newName.toLowerCase())) {
      alert(`Supplier '${newName}' already exists in the grid.`);
      return;
    }
    try {
      setActionLoading(true);
      await actions.renameSupplierColumn(oldName, newName);
    } catch (e: any) {
      alert('Failed to rename supplier: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Remove a supplier column entirely (deletes all its offers in one operation).
  // Only allowed while the comparison is unlocked.
  const handleRemoveSupplier = async (supName: string) => {
    if (comparison.is_locked) return;
    if (!window.confirm(`Remove supplier "${supName}" from the comparison? All its offers across every line item will be deleted.`)) return;
    try {
      setActionLoading(true);
      await actions.removeSupplierColumn(supName);
    } catch (e: any) {
      alert('Failed to remove supplier: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ------------------------------------------------------------
  // GEMINI AI FILE UPLOAD AND PARSING DRAWER
  // ------------------------------------------------------------
  const handleUploadAndExtract = async () => {
    if (!uploadFile) {
      alert('Please select a file quotation first.');
      return;
    }
    try {
      setActionLoading(true);
      const res = await offerExtractionService.extractFromDocument(uploadFile);
      setExtractedData(res.data);
      setConfidence(res.confidence);

      // Attempt auto mappings
      const mappings: Record<number, string> = {};
      res.data.line_items.forEach((extLine, idx) => {
        const bestMatch = fuzzyMatchExtractedLine(extLine.description, comparison.items);
        if (bestMatch) {
          mappings[idx] = bestMatch.id;
        }
      });
      setItemMappings(mappings);

    } catch (e: any) {
      alert('Extraction failed: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Commit extracted lines confirmations
  const handleCommitExtraction = async () => {
    if (!extractedData) return;
    try {
      setActionLoading(true);
      const supplierName = extractedData.supplier_name;
      const ref = extractedData.offer_ref;
      const date = extractedData.offer_date;
      const validity = extractedData.validity;

      for (let idx = 0; idx < extractedData.line_items.length; idx++) {
        const extLine = extractedData.line_items[idx];
        const targetItemId = itemMappings[idx];

        if (targetItemId) {
          // Add offer details for this item
          await actions.addOffer(targetItemId, {
            supplier_name: supplierName,
            offer_source: 'EXTRACTED_PDF',
            extraction_confidence: confidence,
            offer_reference: ref,
            offer_date: date,
            unit_price: extLine.unit_price,
            delivery_days: extLine.delivery_days,
            payment_terms_days: extLine.payment_terms.toLowerCase().includes('cash') || extLine.payment_terms.toLowerCase().includes('cod') ? 0 : parseInt(extLine.payment_terms) || 30,
            brand_offered: extLine.brand,
            is_compliant: true,
            validity_days: validity,
            moq: extLine.moq,
            notes: `Warranty: ${extLine.warranty} months`
          });
        }
      }

      alert('Supplier quotes successfully mapped, scored, and committed to grid.');
      setShowDrawer(false);
      setUploadFile(null);
      setExtractedData(null);
      setConfidence(null);
    } catch (e: any) {
      alert('Error committing extraction: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Filters application
  const filteredItems = comparison.items.filter((item: any) => {
    if (filterMode === 'missing-3') {
      return item.compliant_offers_count < 3 && !item.is_optional;
    }
    if (filterMode === 'overrides') {
      return !item.selection_matches_recommendation;
    }
    if (filterMode === 'non-compliant') {
      return item.compliant_offers_count === 0 && item.offers_count > 0;
    }
    if (filterMode === 'critical-margin') {
      return item.item_margin_status === 'CRITICAL';
    }
    return true;
  });

  return (
    <div className="comp-container">
      {/* Top Navigation Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <Link href="/procurement/comparisons" className="quote-btn quote-btn-secondary" style={{ padding: '0.4rem 0.6rem' }}>
          <ArrowLeft size={16} /> Back to Registry
        </Link>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="quote-btn quote-btn-secondary" onClick={() => setShowDrawer(true)}>
            <Sparkles size={14} style={{ color: '#00E5A0' }} /> Gemini AI Extract
          </button>
          <button className="quote-btn quote-btn-secondary" onClick={handleExportExcel}>
            <FileSpreadsheet size={14} /> Export Excel
          </button>
          <button className="quote-btn quote-btn-secondary" onClick={handleExportPDF}>
            <Download size={14} /> Export PDF
          </button>
          <button className="quote-btn quote-btn-secondary" onClick={refetch}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Header card */}
      <div className="quote-card" style={{ padding: '1.5rem', marginBottom: '1.2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
              <h1 className="comp-header-title" style={{ fontSize: '1.8rem' }}>{comparison.comparison_number}</h1>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>Rev.{comparison.revision}</span>
              <span className={`c-badge c-badge-${comparison.status.toLowerCase()}`}>
                {statusLabels[comparison.status] || comparison.status}
              </span>
            </div>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginTop: '0.4rem' }}>{comparison.project_name}</h3>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '1.2rem', marginTop: '0.5rem' }}>
              <span>Project Ref: <strong style={{ color: 'var(--text-secondary)' }}>{comparison.project_ref}</strong></span>
              <span>Quotation Ref: <strong style={{ color: 'var(--text-secondary)' }}>{comparison.quotation_ref}</strong></span>
              <span>Client: {comparison.client_name}</span>
              <span>Date: {new Date(comparison.comparison_date).toLocaleDateString('en-GB')}</span>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Supplier Procured Cost</span>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#00E5A0', textShadow: '0 0 15px rgba(0, 229, 160, 0.2)' }}>
              {fmtAED(comparison.total_selected_supplier_cost)}
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Project target: {comparison.target_margin_pct}%</span>
          </div>
        </div>
      </div>

      {/* Actions Toolbar bar */}
      <div className="quote-card" style={{ padding: '0.8rem 1.2rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Filters:</span>
          {['all', 'missing-3', 'overrides', 'non-compliant', 'critical-margin'].map((m) => (
            <button
              key={m}
              className={`quote-btn ${filterMode === m ? 'quote-btn-primary' : 'quote-btn-secondary'}`}
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
              onClick={() => setFilterMode(m)}
            >
              {m === 'all' ? 'All Lines' : 
               m === 'missing-3' ? 'Missing 3 Offers' : 
               m === 'overrides' ? 'Overrides Only' : 
               m === 'non-compliant' ? 'Non Compliant' : 'Critical Margins'}
            </button>
          ))}
          
          <button 
            className={`quote-btn ${groupBySystem ? 'quote-btn-primary' : 'quote-btn-secondary'}`}
            style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', marginLeft: '0.8rem' }}
            onClick={() => setGroupBySystem(!groupBySystem)}
          >
            {groupBySystem ? 'Ungroup' : 'Group by System'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {isProcurement && !comparison.is_locked && (
            <>
              <button 
                className="quote-btn quote-btn-secondary" 
                style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem' }} 
                onClick={openAddSupplierModal}
              >
                <Plus size={14} /> Add Supplier Column
              </button>
              <button 
                className="quote-btn quote-btn-secondary" 
                style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem' }} 
                onClick={handleAutoSelectBulk} 
                disabled={actionLoading || Object.keys(localEdits).length > 0}
                title={Object.keys(localEdits).length > 0 ? "Save grid pricing changes first" : ""}
              >
                Auto Select Recommended (Bulk)
              </button>
              <button 
                className="quote-btn quote-btn-secondary" 
                style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem' }} 
                onClick={handleRecalculate} 
                disabled={actionLoading || Object.keys(localEdits).length > 0}
                title={Object.keys(localEdits).length > 0 ? "Save grid pricing changes first" : ""}
              >
                Recalculate Scores
              </button>
              <button 
                className="quote-btn quote-btn-primary" 
                style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem' }} 
                onClick={handleSubmitSheet} 
                disabled={actionLoading || Object.keys(localEdits).length > 0}
                title={Object.keys(localEdits).length > 0 ? "Save grid pricing changes first" : ""}
              >
                Validate & Submit Sheet
              </button>
            </>
          )}

          {isCommercial && comparison.status === 'PENDING_COMMERCIAL' && (
            <Link href={`/procurement/comparisons/${comparison.id}/review`} className="quote-btn quote-btn-primary" style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem' }}>
              Review & Approve
            </Link>
          )}

          {isGM && comparison.status === 'PENDING_GM' && (
            <Link href={`/procurement/comparisons/${comparison.id}/approve`} className="quote-btn quote-btn-primary" style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem' }}>
              GM Approve & Sign
            </Link>
          )}

          {isProcurement && (comparison.status === 'APPROVED' || comparison.status === 'REJECTED') && (
            <button className="quote-btn quote-btn-secondary" style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem' }} onClick={handleCreateRevision} disabled={actionLoading}>
              Reopen (Create Revision)
            </button>
          )}

          {comparison.status === 'APPROVED' && (
            <Link 
              href={`/procurement/po/from-comparison/${comparison.id}`} 
              className="quote-btn quote-btn-primary" 
              style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem', background: '#00E5A0', borderColor: '#00E5A0', color: '#000', fontWeight: 600 }}
            >
              Generate LPOs
            </Link>
          )}
        </div>
      </div>

      {/* Unsaved Changes Banner */}
      {Object.keys(localEdits).length > 0 && (
        <div className="quote-card" style={{ 
          borderColor: 'rgba(245, 158, 11, 0.4)', 
          background: 'rgba(245, 158, 11, 0.08)', 
          padding: '0.8rem 1.2rem', 
          marginBottom: '1rem', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderWidth: '1px',
          borderStyle: 'solid'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#f59e0b' }}>
            <AlertTriangle size={18} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              You have {Object.keys(localEdits).length} unsaved pricing cell edit(s).
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button className="quote-btn quote-btn-secondary" style={{ fontSize: '0.78rem', padding: '0.3rem 0.8rem' }} onClick={handleDiscardChanges} disabled={actionLoading}>
              Discard Changes
            </button>
            <button 
              className="quote-btn quote-btn-primary" 
              style={{ fontSize: '0.78rem', padding: '0.3rem 0.8rem', background: '#f59e0b', borderColor: '#f59e0b', color: '#000', fontWeight: 600 }} 
              onClick={handleSaveGrid} 
              disabled={actionLoading}
            >
              Save Grid Changes
            </button>
          </div>
        </div>
      )}

      {/* MATRIX GRID TABLE */}
      <div className="matrix-scroll-container">
        <table className="matrix-table">
          <thead>
            <tr>
              {/* Frozen Left columns */}
              <th className="frozen-left" style={{ width: '40px', textAlign: 'center' }}>No</th>
              <th className="frozen-left-2" style={{ width: '180px' }}>Item Details</th>
              <th style={{ width: '80px', textAlign: 'center' }}>Qty / Unit</th>
              <th style={{ width: '100px', textAlign: 'right' }}>BOQ Unit Cost</th>
              <th style={{ width: '120px', textAlign: 'right' }}>BOQ Total Budget</th>
              
              {/* Dynamic Supplier Column Groups */}
              {allSupplierNames.map(supName => (
                <th key={supName} colSpan={6} className="supplier-group-header">
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}>
                    <span>{supName}</span>
                    {!comparison.is_locked && (
                      <span style={{ display: 'inline-flex', gap: '0.2rem' }}>
                        <button
                          type="button"
                          title={`Rename ${supName}`}
                          onClick={() => handleRenameSupplier(supName)}
                          disabled={actionLoading}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'inline-flex' }}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          title={`Remove ${supName}`}
                          onClick={() => handleRemoveSupplier(supName)}
                          disabled={actionLoading}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: '2px', display: 'inline-flex' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </span>
                    )}
                  </div>
                </th>
              ))}

              {/* Frozen Right columns */}
              <th className="frozen-right" style={{ width: '220px', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>Selected procurement</th>
            </tr>
            <tr>
              {/* Sub-headers Left */}
              <th className="frozen-left" style={{ borderBottom: '2px solid rgba(255,255,255,0.1)' }}></th>
              <th className="frozen-left-2" style={{ borderBottom: '2px solid rgba(255,255,255,0.1)' }}>Description & Code</th>
              <th style={{ borderBottom: '2px solid rgba(255,255,255,0.1)' }}></th>
              <th style={{ borderBottom: '2px solid rgba(255,255,255,0.1)' }}></th>
              <th style={{ borderBottom: '2px solid rgba(255,255,255,0.1)' }}></th>
              
              {/* Sub-headers for each Supplier */}
              {allSupplierNames.map(supName => (
                <th key={`${supName}-sub`} colSpan={6} style={{ fontSize: '0.7rem', textTransform: 'uppercase', background: 'rgba(0, 0, 0, 0.2)', borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', textAlign: 'center' }}>
                    <span>Unit (AED)</span>
                    <span>Total (AED)</span>
                    <span>Lead (Days)</span>
                    <span>Pay (Days)</span>
                    <span>Comp</span>
                    <span>Score</span>
                  </div>
                </th>
              ))}

              {/* Sub-headers Right */}
              <th className="frozen-right" style={{ borderLeft: '2px solid rgba(255,255,255,0.1)', borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                Selected Cost & Savings
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item: any, idx: number) => {
              
              return (
                <tr key={item.id} style={{ fontStyle: item.is_optional ? 'italic' : 'normal', opacity: item.is_optional ? 0.6 : 1 }}>
                  {/* Frozen Left cell values */}
                  <td className="frozen-left" style={{ textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                  <td className="frozen-left-2" style={{ maxWidth: '280px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <Link href={`/procurement/comparisons/${comparison.id}/item/${item.id}`} style={{ color: 'inherit', fontWeight: 600, textDecoration: 'none' }}>
                        {item.description}
                      </Link>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        Code: {item.item_code}
                      </div>
                    </div>
                  </td>

                  {/* BOQ imported details */}
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {item.quantity} {item.unit}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 500 }}>
                    {fmtAED(item.boq_unit_material_cost).replace('AED ', '')}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {fmtAED(item.boq_total_material_cost).replace('AED ', '')}
                  </td>

                  {/* Supplier cells */}
                  {allSupplierNames.map(supName => {
                    const offer = (item.offers || []).find((o: any) => o.supplier_name === supName);
                    
                    const editKey = makeEditKey(item.id, supName);
                    const localEdit = localEdits[editKey];

                    const displayUnitPrice = localEdit?.unit_price !== undefined ? localEdit.unit_price : (offer ? offer.unit_price.toString() : '');
                    const displayDeliveryDays = localEdit?.delivery_days !== undefined ? localEdit.delivery_days : (offer ? (offer.delivery_days ?? '').toString() : '');
                    const displayPaymentDays = localEdit?.payment_terms_days !== undefined ? localEdit.payment_terms_days : (offer ? offer.payment_terms_days.toString() : '');
                    const displayIsCompliant = localEdit?.is_compliant !== undefined ? localEdit.is_compliant : (offer ? offer.is_compliant : true);

                    const parsedPrice = parseFloat(displayUnitPrice) || 0;
                    const displayTotalPrice = parsedPrice * item.quantity;

                    const isRecommended = offer?.is_recommended;
                    const isLowest = offer?.id === item.lowest_price_offer_id;
                    const isCompliant = displayIsCompliant;
                    
                    // Score chip class
                    let scoreClass = 'score-chip-low';
                    if (offer && offer.score_total >= 80) scoreClass = 'score-chip-high';
                    else if (offer && offer.score_total >= 50) scoreClass = 'score-chip-mid';

                    return (
                      <td key={`${item.id}-${supName}`} colSpan={6} className={!isCompliant ? 'non-compliant-row' : isRecommended ? 'supplier-group-recommended' : ''}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', textAlign: 'center', alignItems: 'center' }}>
                          
                          {/* Unit Price */}
                          <input 
                            type="number" 
                            className="quote-filter-input" 
                            style={{ padding: '2px', width: '100%', fontSize: '0.72rem', textAlign: 'right', background: 'transparent' }}
                            value={displayUnitPrice}
                            disabled={comparison.is_locked}
                            placeholder="AED"
                            onChange={(e) => handleLocalChange(item.id, supName, 'unit_price', e.target.value)}
                          />

                          {/* Supplier calculated total price */}
                          <div style={{ fontSize: '0.72rem', textAlign: 'right', fontWeight: 600, paddingRight: '2px' }}>
                            {displayUnitPrice ? fmtAED(displayTotalPrice).replace('AED ', '') : '-'}
                          </div>

                          {/* Delivery Lead time */}
                          <input 
                            type="number" 
                            className="quote-filter-input" 
                            style={{ padding: '2px', width: '100%', fontSize: '0.72rem', textAlign: 'center', background: 'transparent' }}
                            value={displayDeliveryDays}
                            disabled={comparison.is_locked}
                            placeholder="Days"
                            onChange={(e) => handleLocalChange(item.id, supName, 'delivery_days', e.target.value)}
                          />

                          {/* Payment terms days */}
                          <input 
                            type="number" 
                            className="quote-filter-input" 
                            style={{ padding: '2px', width: '100%', fontSize: '0.72rem', textAlign: 'center', background: 'transparent' }}
                            value={displayPaymentDays}
                            disabled={comparison.is_locked}
                            placeholder="30"
                            onChange={(e) => handleLocalChange(item.id, supName, 'payment_terms_days', e.target.value)}
                          />

                          {/* Compliance checkbox */}
                          <input 
                            type="checkbox"
                            checked={displayIsCompliant}
                            disabled={comparison.is_locked}
                            onChange={(e) => handleLocalChange(item.id, supName, 'is_compliant', e.target.checked)}
                          />

                          {/* Scores & Badges */}
                          <div>
                            {offer ? (
                              <div className={`score-chip ${scoreClass}`}>
                                {offer.score_total.toFixed(0)}
                                
                                {/* Hover tooltip breakdown */}
                                <div className="score-tooltip">
                                  <div className="score-tooltip-item"><span>Price:</span> <span>{offer.score_price.toFixed(0)}</span></div>
                                  <div className="score-tooltip-item"><span>Lead:</span> <span>{offer.score_delivery.toFixed(0)}</span></div>
                                  <div className="score-tooltip-item"><span>History:</span> <span>{offer.score_history.toFixed(0)}</span></div>
                                  <div className="score-tooltip-item"><span>Payment:</span> <span>{offer.score_payment.toFixed(0)}</span></div>
                                  <div className="score-tooltip-item"><span>Compl:</span> <span>{offer.score_compliance.toFixed(0)}</span></div>
                                </div>
                              </div>
                            ) : '-'}
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px', alignItems: 'center' }}>
                              {isRecommended && <span className="best-tag">★ BEST</span>}
                              {isLowest && !isRecommended && <span className="lowest-tag">$ LOWEST</span>}
                            </div>
                          </div>

                        </div>
                      </td>
                    );
                  })}

                  {/* Frozen Right Selected Supplier cells */}
                  <td className="frozen-right" style={{ borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <select
                        className="quote-filter-input"
                        style={{ width: '100%', fontSize: '0.78rem', padding: '0.2rem' }}
                        value={item.selected_supplier_offer_id || ''}
                        disabled={comparison.is_locked}
                        onChange={(e) => actions.selectSupplier(item.id, e.target.value || null, item.override_reason || '')}
                      >
                        <option value="">-- Choose Supplier --</option>
                        {(item.offers || []).map((o: any) => (
                          <option key={o.id} value={o.id}>{o.supplier_name} ({fmtAED(o.unit_price)})</option>
                        ))}
                      </select>

                      {/* Financial info on selection */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        <span>Procured Cost:</span>
                        <span style={{ fontWeight: 600 }}>{fmtAED(item.selected_total_cost)}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <span>Savings vs BOQ:</span>
                        <span style={{ fontWeight: 600, color: item.item_savings_vs_boq >= 0 ? '#10b981' : '#ef4444' }}>
                          {fmtAED(item.item_savings_vs_boq)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <span>Margin %:</span>
                        <span style={{ fontWeight: 600 }}>{item.item_margin_pct.toFixed(1)}%</span>
                      </div>

                      {/* Override justification text box */}
                      {!item.selection_matches_recommendation && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '0.2rem' }}>
                          <span style={{ fontSize: '0.62rem', color: 'var(--warning)', fontWeight: 600 }}>Override Reason Required (+{fmtAED(item.override_cost_impact)})</span>
                          <input
                            type="text"
                            className={`quote-filter-input ${!item.override_reason ? 'override-warning-glow' : ''}`}
                            style={{ padding: '2px', fontSize: '0.72rem', width: '100%' }}
                            placeholder="Type justification reason..."
                            value={item.override_reason || ''}
                            disabled={comparison.is_locked}
                            onChange={(e) => actions.selectSupplier(item.id, item.selected_supplier_offer_id, e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Sticky totals summary footer */}
          <tfoot className="matrix-sticky-footer">
            <tr>
              <td className="frozen-left"></td>
              <td className="frozen-left-2">
                <div>Grand Totals / Overall Margin</div>
              </td>
              <td></td>
              <td></td>
              <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {fmtAED(comparison.total_boq_material_cost).replace('AED ', '')}
              </td>

              {/* Supplier Grand Totals per column */}
              {allSupplierNames.map(supName => {
                // Calculate grand total for this supplier across all items
                let supplierGrandTotal = 0;
                comparison.items.forEach((item: any) => {
                  const editKey = makeEditKey(item.id, supName);
                  const localEdit = localEdits[editKey];
                  const offer = (item.offers || []).find((o: any) => o.supplier_name === supName);
                  const unitPrice = localEdit?.unit_price !== undefined 
                    ? (parseFloat(localEdit.unit_price) || 0) 
                    : (offer ? offer.unit_price : 0);
                  supplierGrandTotal += unitPrice * item.quantity;
                });

                return (
                  <td key={`${supName}-foot`} colSpan={6}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Grand Total</span>
                      <span style={{ 
                        fontSize: '0.85rem', 
                        fontWeight: 700, 
                        fontFamily: 'var(--font-mono)',
                        color: supplierGrandTotal > 0 ? 'var(--text-primary)' : 'var(--text-muted)' 
                      }}>
                        {supplierGrandTotal > 0 ? fmtAED(supplierGrandTotal) : '—'}
                      </span>
                    </div>
                  </td>
                );
              })}

              <td className="frozen-right" style={{ borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Selected Cost:</span>
                    <span style={{ color: '#00E5A0' }}>{fmtAED(comparison.total_selected_supplier_cost)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>BOQ Savings:</span>
                    <span style={{ color: '#22d3ee' }}>{fmtAED(comparison.total_savings_vs_boq)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Overall Margin:</span>
                    <span style={{ color: comparison.overall_margin_pct >= comparison.target_margin_pct ? '#10b981' : '#ef4444' }}>
                      {comparison.overall_margin_pct.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>
                    <span>Extra Potential Savings:</span>
                    <span>{fmtAED(comparison.potential_extra_savings)}</span>
                  </div>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* MANUAL ADD SUPPLIER MODAL */}
      {showAddSupplierModal && (
        <div className="quote-modal-overlay">
          <div className="quote-modal">
            <div className="quote-modal-header">
              <h3 className="quote-card-title">Add Supplier Column</h3>
            </div>
            <div className="quote-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="quote-form-group">
                <label>Supplier ({registeredSuppliers.length} registered)</label>
                <input
                  type="text"
                  list="registered-suppliers-list"
                  className="quote-form-input"
                  placeholder="Pick a registered supplier or type a new name…"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  autoFocus
                />
                <datalist id="registered-suppliers-list">
                  {registeredSuppliers.map(s => <option key={s.id} value={s.name} />)}
                </datalist>
                {newSupplierName.trim() && !registeredSuppliers.some(s => s.name.toLowerCase() === newSupplierName.trim().toLowerCase()) && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--secondary)', marginTop: '0.35rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Plus size={11} /> New supplier — will be registered in the supplier module.
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button className="quote-btn quote-btn-secondary" onClick={() => setShowAddSupplierModal(false)}>Cancel</button>
                <button className="quote-btn quote-btn-primary" onClick={handleAddSupplierColumn} disabled={!newSupplierName.trim()}>Add Column</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GEMINI AI EXTRACTION DRAWER PANEL */}
      {showDrawer && (
        <div className="quote-modal-overlay">
          <div className="quote-modal" style={{ maxWidth: '800px' }}>
            <div className="quote-modal-header">
              <h3 className="quote-card-title">
                <Sparkles size={18} style={{ color: '#00E5A0' }} /> 
                Gemini AI Supplier Proposal Extractor
              </h3>
              <button className="quote-btn quote-btn-secondary" style={{ padding: '0.3rem', border: 'none', background: 'transparent' }} onClick={() => setShowDrawer(false)}>
                &times;
              </button>
            </div>
            <div className="quote-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Drag & drop or browse a quotation document (PDF/Excel) to parse structured fields with Gemini 2.0 Flash. 
                Values will be automatically mapped to comparison items based on description similarity.
              </p>

              {/* Upload controls */}
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <input 
                  type="file" 
                  accept=".pdf,.xlsx,.xls" 
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)} 
                />
                <button 
                  className="quote-btn quote-btn-primary"
                  onClick={handleUploadAndExtract}
                  disabled={actionLoading || !uploadFile}
                >
                  Parse Document
                </button>
              </div>

              {/* Extraction confirmation mapping preview */}
              {extractedData && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.85rem' }}>Supplier identified: <strong>{extractedData.supplier_name}</strong></span>
                    <span style={{ fontSize: '0.85rem', color: '#00E5A0' }}>AI Confidence: <strong>{confidence}%</strong></span>
                  </div>

                  <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Confirm Line Mappings</h4>
                  
                  <div className="quote-table-wrap" style={{ maxHeight: '30vh', overflowY: 'auto' }}>
                    <table className="quote-table">
                      <thead>
                        <tr>
                          <th>Extracted Description</th>
                          <th style={{ width: '80px' }}>Brand</th>
                          <th style={{ width: '80px', textAlign: 'right' }}>Price</th>
                          <th>Map to BOQ Comparison Item</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extractedData.line_items.map((line: any, idx: number) => (
                          <tr key={idx}>
                            <td style={{ fontSize: '0.75rem' }}>{line.description}</td>
                            <td>{line.brand}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtAED(line.unit_price)}</td>
                            <td>
                              <select
                                className="quote-filter-input"
                                style={{ width: '100%', fontSize: '0.72rem', padding: '2px' }}
                                value={itemMappings[idx] || ''}
                                onChange={(e) => setItemMappings(prev => ({ ...prev, [idx]: e.target.value }))}
                              >
                                <option value="">-- Ignore / Do not map --</option>
                                {comparison.items.map((i: any) => (
                                  <option key={i.id} value={i.id}>{i.description}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <button className="quote-btn quote-btn-secondary" onClick={() => setExtractedData(null)}>Reset</button>
                    <button className="quote-btn quote-btn-primary" onClick={handleCommitExtraction} disabled={actionLoading}>
                      Commit Extracted Offers
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
