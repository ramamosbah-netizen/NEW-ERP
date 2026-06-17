// ============================================================
// JEET ERP — Quotations List Dashboard Page
// Routes: /quotations
// ============================================================

'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  Calendar, 
  ArrowRight,
  Eye,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { useQuotations } from '@/hooks/useQuotations';
import './quotations.css';

const fmtAED = (v: number) => {
  return 'AED ' + new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

export default function QuotationsListPage() {
  const [filters, setFilters] = useState<any>({
    status: '',
    search: '',
    date_from: '',
    date_to: ''
  });

  const { quotations, loading, error, refetch } = useQuotations(filters);
  const [projects, setProjects] = useState<any[]>([]);
  const [showBOQModal, setShowBOQModal] = useState(false);
  const [finalizedBOQs, setFinalizedBOQs] = useState<any[]>([]);
  const [boqLoading, setBoqLoading] = useState(false);

  // Fetch projects/tenders for filter dropdown
  useEffect(() => {
    supabase.from('tenders').select('id, title').then(({ data }) => {
      if (data) setProjects(data);
    });
  }, []);

  // Fetch finalized BOQs that don't have active quotations
  const openNewQuotationModal = async () => {
    setShowBOQModal(true);
    try {
      setBoqLoading(true);
      // 1. Fetch finalized BOQs
      const { data: boqs, error: boqErr } = await supabase
        .from('boqs')
        .select('*, tenders(*)')
        .eq('status', 'finalized');

      if (boqErr) throw boqErr;

      // 2. Fetch all quotations that are active
      const { data: quotes, error: qErr } = await supabase
        .from('quotations')
        .select('boq_id')
        .in('status', ['DRAFT', 'PENDING_COMMERCIAL', 'PENDING_GM', 'APPROVED', 'SENT_TO_CLIENT', 'ACCEPTED']);

      if (qErr) throw qErr;

      const activeBOQIds = new Set((quotes || []).map(q => q.boq_id));

      // 3. Filter BOQs that don't have active quotes
      const availableBOQs = (boqs || []).filter(boq => !activeBOQIds.has(boq.id));
      setFinalizedBOQs(availableBOQs);
    } catch (err) {
      logger.error('Error fetching available BOQs:', err);
    } finally {
      setBoqLoading(false);
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev: any) => ({ ...prev, [name]: value }));
  };

  // Status mapping
  const statusLabels: Record<string, string> = {
    DRAFT: 'Draft',
    PENDING_COMMERCIAL: 'Pending Commercial',
    PENDING_GM: 'Pending GM',
    APPROVED: 'Approved',
    SENT_TO_CLIENT: 'Sent to Client',
    ACCEPTED: 'Accepted',
    REJECTED: 'Rejected',
    REVISED: 'Revised',
    SUPERSEDED: 'Superseded'
  };

  return (
    <div className="quote-container">
      {/* Header */}
      <header className="quote-header">
        <div>
          <h1 className="quote-header-title">Quotation Registry</h1>
          <p className="quote-header-subtitle">JEET ERP ELV & MEP Commercial proposals manager</p>
        </div>
        <button className="quote-btn quote-btn-primary" onClick={openNewQuotationModal}>
          <Plus size={16} /> New Quotation
        </button>
      </header>

      {/* Filters bar */}
      <div className="quote-card">
        <div className="quote-filters-bar">
          <div style={{ display: 'flex', flex: 1, gap: '1rem', minWidth: '300px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                name="search"
                className="quote-filter-input"
                placeholder="Search quotation number, client name, subject..."
                style={{ paddingLeft: '2.2rem', width: '100%' }}
                value={filters.search}
                onChange={handleFilterChange}
              />
            </div>
          </div>

          <select
            name="status"
            className="quote-filter-input"
            value={filters.status}
            onChange={handleFilterChange}
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_COMMERCIAL">Pending Commercial</option>
            <option value="PENDING_GM">Pending GM</option>
            <option value="APPROVED">Approved</option>
            <option value="SENT_TO_CLIENT">Sent to Client</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
            <option value="REVISED">Revised</option>
            <option value="SUPERSEDED">Superseded</option>
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              type="date"
              name="date_from"
              className="quote-filter-input"
              value={filters.date_from}
              onChange={handleFilterChange}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>to</span>
            <input
              type="date"
              name="date_to"
              className="quote-filter-input"
              value={filters.date_to}
              onChange={handleFilterChange}
            />
          </div>

          <button className="quote-btn quote-btn-secondary" onClick={() => refetch()}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Main List */}
      <div className="quote-card">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
            <p style={{ color: 'var(--text-secondary)' }}>Loading quotations registry...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
            <p>Error loading registry details: {error.message}</p>
          </div>
        ) : quotations.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <FileText size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
            <p>No quotations found matching your criteria</p>
          </div>
        ) : (
          <div className="quote-table-wrap">
            <table className="quote-table">
              <thead>
                <tr>
                  <th>Quotation No</th>
                  <th>Rev</th>
                  <th>Project Ref</th>
                  <th>Client Name</th>
                  <th>Subject</th>
                  <th>Quote Date</th>
                  <th>Valid Until</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Grand Total (inc VAT)</th>
                  <th>Prepared By</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((quote: any) => (
                  <tr key={quote.id}>
                    <td style={{ fontWeight: 600, color: 'var(--secondary)' }}>
                      <Link href={`/quotations/${quote.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {quote.quotation_number}
                      </Link>
                    </td>
                    <td>{quote.revision_label}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{quote.project_ref}</td>
                    <td>{quote.client_name}</td>
                    <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {quote.subject}
                    </td>
                    <td>{new Date(quote.quotation_date).toLocaleDateString('en-GB')}</td>
                    <td>{new Date(quote.valid_until).toLocaleDateString('en-GB')}</td>
                    <td>
                      <span className={`q-badge q-badge-${quote.status.toLowerCase()}`}>
                        {statusLabels[quote.status] || quote.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>
                      {fmtAED(quote.grand_total_with_vat)}
                    </td>
                    <td>{quote.prepared_by_name || 'Estimator'}</td>
                    <td style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                      <Link href={`/quotations/${quote.id}`} className="quote-btn quote-btn-secondary" style={{ padding: '0.3rem 0.6rem' }}>
                        <Eye size={12} /> View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* BOQ SELECTOR MODAL */}
      {showBOQModal && (
        <div className="quote-modal-overlay">
          <div className="quote-modal">
            <div className="quote-modal-header">
              <h3 className="quote-card-title">Select Finalized BOQ</h3>
              <button className="quote-btn quote-btn-secondary" style={{ padding: '0.3rem' }} onClick={() => setShowBOQModal(false)}>
                &times;
              </button>
            </div>
            <div className="quote-modal-body">
              {boqLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
                  <p>Searching for finalized BOQs...</p>
                </div>
              ) : finalizedBOQs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  <p>No finalized BOQs are currently available for quotation.</p>
                  <p style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>Note: BOQs must be in <strong>FINALIZED</strong> status, and cannot have an active quotation linked.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {finalizedBOQs.map((boq: any) => (
                    <div 
                      key={boq.id} 
                      className="quote-card" 
                      style={{ 
                        margin: 0, 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        background: 'var(--surface-hover)',
                        borderColor: 'var(--surface-hover)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{boq.tenders?.title || 'Tender / Project'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          Client: {boq.tenders?.client_name || 'N/A'} | Version: {boq.version}
                        </div>
                      </div>
                      <Link 
                        href={`/quotations/new/${boq.id}`} 
                        className="quote-btn quote-btn-primary"
                        onClick={() => setShowBOQModal(false)}
                      >
                        Select <ArrowRight size={12} />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
