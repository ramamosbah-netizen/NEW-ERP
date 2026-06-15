// ============================================================
// JEET ERP — Create Supplier Comparison Sheet Wizard
// Routes: /procurement/comparisons/new/:quotationId
// ============================================================

'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  CheckCircle, 
  AlertCircle,
  FileText,
  DollarSign,
  TrendingUp,
  Briefcase,
  Layers
} from 'lucide-react';
import { comparisonService } from '@/lib/comparison-service';
import '../../comparisons.css';

const fmtAED = (v: number) => {
  return 'AED ' + new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

export default function CreateComparisonWizard({ params }: { params: Promise<{ quotationId: string }> }) {
  const router = useRouter();
  const { quotationId } = use(params);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Quotation metadata snapshots
  const [quotation, setQuotation] = useState<any | null>(null);
  const [importedItems, setImportedItems] = useState<any[]>([]);

  // Inputs
  const [targetMargin, setTargetMargin] = useState(15.00);

  useEffect(() => {
    const loadQuotationDetails = async () => {
      try {
        setLoading(true);
        setErrorMsg('');

        // 1. Fetch quotation
        const { data: quote, error: quoteErr } = await supabase
          .from('quotations')
          .select('*, boqs(*)')
          .eq('id', quotationId)
          .single();

        if (quoteErr || !quote) throw new Error('Quotation not found.');
        
        if (quote.status !== 'ACCEPTED') {
          setErrorMsg('A supplier comparison sheet can only be created from an ACCEPTED quotation.');
          setLoading(false);
          return;
        }

        setQuotation(quote);

        // 2. Fetch imported non-optional quotation lines
        const { data: lines, error: linesErr } = await supabase
          .from('quotation_lines')
          .select('*')
          .eq('quotation_id', quotationId)
          .eq('is_optional', false)
          .order('line_number', { ascending: true });

        if (linesErr) throw linesErr;
        setImportedItems(lines || []);

      } catch (err: any) {
        console.error('Error loading wizard details:', err);
        setErrorMsg(err.message || 'Failed to initialize details from quotation.');
      } finally {
        setLoading(false);
      }
    };

    loadQuotationDetails();
  }, [quotationId]);

  const handleCreateComparison = async () => {
    try {
      setSaving(true);
      setErrorMsg('');

      const comp = await comparisonService.createFromQuotation(quotationId, targetMargin);
      
      alert('Supplier Comparison sheet initialized successfully as DRAFT.');
      router.push(`/procurement/comparisons/${comp.id}`);
    } catch (err: any) {
      console.error('Error creating comparison:', err);
      setErrorMsg(err.message || 'Failed to create comparison sheet.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="comp-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Importing BOQ items & client metadata...</p>
      </div>
    );
  }

  if (errorMsg && !quotation) {
    return (
      <div className="comp-container">
        <div className="quote-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)', textAlign: 'center', padding: '3rem' }}>
          <AlertCircle size={48} style={{ color: '#ef4444', margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', marginBottom: '1rem' }}>Initialization Gate Blocked</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{errorMsg}</p>
          <Link href="/procurement/comparisons" className="quote-btn quote-btn-secondary">
            <ArrowLeft size={14} /> Back to Registry
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="comp-container">
      {/* Header */}
      <header className="comp-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/procurement/comparisons" className="quote-btn quote-btn-secondary" style={{ padding: '0.4rem 0.6rem' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="comp-header-title">Create Supplier Comparison Sheet</h1>
            <p className="comp-header-subtitle">Import items and prepare procurement bid configurations</p>
          </div>
        </div>
      </header>

      {errorMsg && (
        <div className="quote-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Proposal Snapshots */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Header Card */}
          <div className="quote-card">
            <h3 className="quote-card-title"><Briefcase size={18} /> Project & Client Snapshot</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginTop: '1rem' }}>
              <p><strong>Quotation Number:</strong> {quotation.quotation_number} {quotation.revision_label}</p>
              <p><strong>Subject:</strong> {quotation.subject}</p>
              <p><strong>Client Name:</strong> {quotation.client_name}</p>
              <p><strong>Project Ref:</strong> {quotation.project_ref}</p>
              <p><strong>Tender Ref:</strong> {quotation.tender_ref || 'N/A'}</p>
              <p><strong>LPO / PO Reference:</strong> {quotation.client_po_number}</p>
              <p><strong>Quotation Date:</strong> {new Date(quotation.quotation_date).toLocaleDateString('en-GB')}</p>
              <p><strong>Revenue (Excl. VAT):</strong> {fmtAED(quotation.subtotal_after_discount)}</p>
            </div>
          </div>

          {/* Imported Lines preview */}
          <div className="quote-card">
            <h3 className="quote-card-title"><Layers size={18} /> Imported Items ({importedItems.length})</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Only non-optional items are imported into comparison matrix. Optional items are excluded.</p>
            
            <div className="quote-table-wrap" style={{ marginTop: '1rem', maxHeight: '40vh', overflowY: 'auto' }}>
              <table className="quote-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>No</th>
                    <th>Code</th>
                    <th>Description</th>
                    <th>System</th>
                    <th style={{ width: '60px' }}>Unit</th>
                    <th style={{ width: '80px', textAlign: 'right' }}>Quantity</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Revenue (Excl. VAT)</th>
                  </tr>
                </thead>
                <tbody>
                  {importedItems.map((line: any, idx: number) => (
                    <tr key={line.id}>
                      <td>{idx + 1}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{line.item_code}</td>
                      <td>{line.description}</td>
                      <td>{line.system}</td>
                      <td>{line.unit}</td>
                      <td style={{ textAlign: 'right' }}>{line.quantity}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtAED(line.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Procurement Config side panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="quote-card">
            <h3 className="quote-card-title"><TrendingUp size={18} /> Procurement Pre-flight</h3>
            
            {/* Target Margin Slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '1.5rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Target Project Margin</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input 
                  type="range" 
                  min="0" 
                  max="50" 
                  step="0.5" 
                  className="weight-slider"
                  value={targetMargin} 
                  onChange={(e) => setTargetMargin(parseFloat(e.target.value))} 
                />
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)', width: '60px', textAlign: 'right' }}>
                  {targetMargin.toFixed(1)}%
                </span>
              </div>
              <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Defines target procurement markup. Used to highlight critical cost variances.
              </p>
            </div>

            {/* Config Summaries */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1.5rem', borderTop: '1px solid var(--surface-hover)', paddingTop: '1.2rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Material Revenue:</span>
                <span style={{ fontWeight: 600 }}>{fmtAED(quotation.subtotal_after_discount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Target Cost Ceiling:</span>
                <span style={{ fontWeight: 600, color: '#22d3ee' }}>
                  {fmtAED(quotation.subtotal_after_discount * (1 - targetMargin / 100))}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Single Approver Limit:</span>
                <span style={{ fontWeight: 600 }}>AED 50,000.00</span>
              </div>
            </div>

            <button 
              className="quote-btn quote-btn-primary" 
              style={{ width: '100%', justifyContent: 'center', marginTop: '2rem' }}
              disabled={saving}
              onClick={handleCreateComparison}
            >
              {saving ? 'Initializing matrix...' : 'Initialize Comparison Matrix'}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
