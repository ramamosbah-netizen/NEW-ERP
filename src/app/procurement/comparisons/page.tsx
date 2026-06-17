// ============================================================
// JEET ERP — Supplier Comparisons Registry Dashboard
// Routes: /procurement/comparisons
// ============================================================

'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  Calendar, 
  ArrowRight,
  Eye,
  RefreshCw,
  TrendingUp,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { useComparisons } from '@/hooks/useComparisons';
import './comparisons.css';

const fmtAED = (v: number) => {
  return 'AED ' + new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

export default function ComparisonsRegistryPage() {
  const router = useRouter();
  
  // State filters
  const [filters, setFilters] = useState<any>({
    status: '',
    search: '',
    date_from: '',
    date_to: ''
  });

  const { comparisons, loading, error, refetch } = useComparisons(filters);
  const [acceptedQuotations, setAcceptedQuotations] = useState<any[]>([]);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  // Statistics
  const [kpis, setKpis] = useState({
    activeCount: 0,
    avgMargin: 0,
    totalSavings: 0,
    pendingApproval: 0
  });

  // Calculate statistics from comparisons data
  useEffect(() => {
    supabase.from('supplier_comparisons').select('*').then(({ data }) => {
      if (data) {
        const active = data.filter(c => ['DRAFT', 'PRICING_IN_PROGRESS', 'PENDING_COMMERCIAL', 'PENDING_GM'].includes(c.status)).length;
        const pending = data.filter(c => ['PENDING_COMMERCIAL', 'PENDING_GM'].includes(c.status)).length;
        
        // Margins and savings averages for APPROVED sheets
        const approvedSheets = data.filter(c => c.status === 'APPROVED');
        const avgMarginVal = approvedSheets.length > 0 
          ? approvedSheets.reduce((sum, c) => sum + (Number(c.overall_margin_pct) || 0), 0) / approvedSheets.length 
          : 0;
        const totalSavingsVal = approvedSheets.reduce((sum, c) => sum + (Number(c.total_savings_vs_boq) || 0), 0);

        setKpis({
          activeCount: active,
          avgMargin: avgMarginVal,
          totalSavings: totalSavingsVal,
          pendingApproval: pending
        });
      }
    });
  }, [comparisons]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev: any) => ({ ...prev, [name]: value }));
  };

  // Open modal and fetch ACCEPTED quotations that do not have active comparison sheets yet
  const openNewComparisonModal = async () => {
    setShowQuoteModal(true);
    try {
      setQuoteLoading(true);
      
      // 1. Fetch all ACCEPTED quotations
      const { data: quotes, error: qErr } = await supabase
        .from('quotations')
        .select('*')
        .eq('status', 'ACCEPTED');

      if (qErr) throw qErr;

      // 2. Fetch all supplier comparisons that are active
      const { data: comps, error: cErr } = await supabase
        .from('supplier_comparisons')
        .select('quotation_id')
        .in('status', ['DRAFT', 'PRICING_IN_PROGRESS', 'PENDING_COMMERCIAL', 'PENDING_GM', 'APPROVED']);

      if (cErr) throw cErr;

      const activeQuoteIds = new Set((comps || []).map(c => c.quotation_id));
      
      // 3. Filter out quotations that already have comparisons
      const availableQuotes = (quotes || []).filter(q => !activeQuoteIds.has(q.id));
      setAcceptedQuotations(availableQuotes);

    } catch (e) {
      logger.error('Error fetching accepted quotations:', e);
    } finally {
      setQuoteLoading(false);
    }
  };

  const statusLabels: Record<string, string> = {
    DRAFT: 'Draft',
    PRICING_IN_PROGRESS: 'Pricing in Progress',
    PENDING_COMMERCIAL: 'Pending Commercial',
    PENDING_GM: 'Pending GM Approval',
    APPROVED: 'Approved',
    REVISED: 'Revised',
    SUPERSEDED: 'Superseded',
    REJECTED: 'Rejected'
  };

  const getMarginClass = (pct: number) => {
    if (pct >= 15.00) return 'text-healthy';
    if (pct >= 10.00) return 'text-warning';
    return 'text-critical';
  };

  return (
    <div className="comp-container">
      {/* Header */}
      <header className="comp-header">
        <div>
          <h1 className="comp-header-title">Supplier Comparison Sheet Registry</h1>
          <p className="comp-header-subtitle">Procurement Intelligence, Supplier Scoring & Margin Audit Workbench</p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.8rem' }}>
          <Link href="/settings/scoring-weights" className="quote-btn quote-btn-secondary">
            Scoring Config
          </Link>
          <button className="quote-btn quote-btn-primary" onClick={openNewComparisonModal}>
            <Plus size={16} /> New Comparison
          </button>
        </div>
      </header>

      {/* KPI Stats */}
      <div className="proc-kpis">
        <div className="proc-kpi-card">
          <span className="proc-kpi-title">Active Sheets</span>
          <span className="proc-kpi-value">{kpis.activeCount}</span>
          <span className="proc-kpi-desc">In Draft or Pricing states</span>
        </div>
        <div className="proc-kpi-card">
          <span className="proc-kpi-title">Avg Procurement Margin</span>
          <span className="proc-kpi-value" style={{ color: 'var(--accent)' }}>{kpis.avgMargin.toFixed(2)}%</span>
          <span className="proc-kpi-desc">Based on approved comparison sheets</span>
        </div>
        <div className="proc-kpi-card">
          <span className="proc-kpi-title">Total Savings YTD</span>
          <span className="proc-kpi-value" style={{ color: '#22d3ee' }}>{fmtAED(kpis.totalSavings)}</span>
          <span className="proc-kpi-desc">Savings vs original BOQ budget cost</span>
        </div>
        <div className="proc-kpi-card">
          <span className="proc-kpi-title">Awaiting Approval</span>
          <span className="proc-kpi-value" style={{ color: 'var(--warning)' }}>{kpis.pendingApproval}</span>
          <span className="proc-kpi-desc">Pending Commercial/GM sign-off</span>
        </div>
      </div>

      {/* Filters */}
      <div className="quote-card">
        <div className="quote-filters-bar">
          <div style={{ display: 'flex', flex: 1, gap: '1rem', minWidth: '300px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                name="search"
                className="quote-filter-input"
                placeholder="Search comparison number, project ref, client..."
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
            <option value="PRICING_IN_PROGRESS">Pricing In Progress</option>
            <option value="PENDING_COMMERCIAL">Pending Commercial</option>
            <option value="PENDING_GM">Pending GM</option>
            <option value="APPROVED">Approved</option>
            <option value="REVISED">Revised</option>
            <option value="SUPERSEDED">Superseded</option>
            <option value="REJECTED">Rejected</option>
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

          <button className="quote-btn quote-btn-secondary" onClick={refetch}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Comparisons Registry List */}
      <div className="quote-card">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
            <p style={{ color: 'var(--text-secondary)' }}>Loading comparisons registry...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
            <p>Error loading registry details: {error.message}</p>
          </div>
        ) : comparisons.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <FileText size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
            <p>No supplier comparisons found matching the search criteria.</p>
          </div>
        ) : (
          <div className="quote-table-wrap">
            <table className="quote-table">
              <thead>
                <tr>
                  <th>Comparison No</th>
                  <th>Rev</th>
                  <th>Project Ref</th>
                  <th>Project Name</th>
                  <th>Client</th>
                  <th>Quotation Ref</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Selected Supplier Cost</th>
                  <th style={{ textAlign: 'right' }}>Overall Margin</th>
                  <th style={{ textAlign: 'right' }}>Savings vs BOQ</th>
                  <th style={{ textAlign: 'center' }}>Overrides</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((c: any) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600, color: 'var(--secondary)' }}>
                      <Link href={`/procurement/comparisons/${c.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {c.comparison_number}
                      </Link>
                    </td>
                    <td>{c.revision}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{c.project_ref}</td>
                    <td>{c.project_name}</td>
                    <td>{c.client_name}</td>
                    <td>{c.quotation_ref}</td>
                    <td>{new Date(c.comparison_date).toLocaleDateString('en-GB')}</td>
                    <td>
                      <span className={`c-badge c-badge-${c.status.toLowerCase()}`}>
                        {statusLabels[c.status] || c.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {fmtAED(c.total_selected_supplier_cost)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }} className={getMarginClass(c.overall_margin_pct)}>
                      {c.overall_margin_pct.toFixed(2)}%
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#22d3ee' }}>
                      {fmtAED(c.total_savings_vs_boq)}
                    </td>
                    <td style={{ textAlign: 'center', color: c.override_count > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                      {c.override_count}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Link href={`/procurement/comparisons/${c.id}`} className="quote-btn quote-btn-secondary" style={{ padding: '0.3rem 0.6rem' }}>
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

      {/* ACCEPTED QUOTATIONS MODAL SELECTOR */}
      {showQuoteModal && (
        <div className="quote-modal-overlay">
          <div className="quote-modal">
            <div className="quote-modal-header">
              <h3 className="quote-card-title">Select Accepted Client Quotation</h3>
              <button className="quote-btn quote-btn-secondary" style={{ padding: '0.3rem', border: 'none', background: 'transparent' }} onClick={() => setShowQuoteModal(false)}>
                &times;
              </button>
            </div>
            <div className="quote-modal-body">
              {quoteLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
                  <p>Searching for accepted proposals...</p>
                </div>
              ) : acceptedQuotations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                  <AlertCircle size={36} style={{ margin: '0 auto 0.8rem auto', opacity: 0.4 }} />
                  <p>No new accepted quotations are available.</p>
                  <p style={{ fontSize: '0.72rem', marginTop: '0.4rem' }}>Note: Quotations must be marked as <strong>ACCEPTED</strong> in the system and cannot have an active comparison sheet already linked.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {acceptedQuotations.map((q: any) => (
                    <div 
                      key={q.id} 
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
                        <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{q.quotation_number} {q.revision_label}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          Subject: {q.subject}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                          Client: {q.client_name} | Revenue: {fmtAED(q.grand_total_with_vat)}
                        </div>
                      </div>
                      <Link 
                        href={`/procurement/comparisons/new/${q.id}`} 
                        className="quote-btn quote-btn-primary"
                        onClick={() => setShowQuoteModal(false)}
                      >
                        Compare <ArrowRight size={12} />
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
