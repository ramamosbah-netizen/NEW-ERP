// ============================================================
// JEET ERP — Goods Receipt Note (GRN) & Returns Dashboard
// Route: /procurement/grn
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useGRNs, useGRNReturns } from '@/hooks/useGRNs';
import { GRN_STATUS_LABELS, GRN_STATUS_COLORS, GRN_LOCATION_LABELS, GRN_RETURN_STATUS_LABELS, GRN_RETURN_STATUS_COLORS, GRN_REJECTION_REASONS } from '@/constants/po.constants';
import { 
  Plus, 
  Search, 
  FileText, 
  Eye, 
  RefreshCw, 
  Truck, 
  AlertOctagon, 
  RotateCcw,
  CheckCircle,
  FileCheck,
  MapPin,
  Calendar,
  XCircle,
  PackageCheck
} from 'lucide-react';
import '@/app/procurement/comparisons/comparisons.css';

const fmtAED = (v: number) => {
  return 'AED ' + new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

export default function GRNRegistryDashboard() {
  const [activeTab, setActiveTab] = useState<'GRN' | 'RETURNS'>('GRN');
  const [searchQuery, setSearchQuery] = useState('');
  
  const { grns, loading: grnLoading, refetch: refetchGRNs } = useGRNs();
  const { returns, loading: retLoading, refetch: refetchReturns, updateReturnStatus } = useGRNReturns();

  const [kpis, setKpis] = useState({
    totalReceipts: 0,
    rejectionsYTD: 0,
    activeReturns: 0
  });

  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  // Sign off return modal state
  const [selectedReturn, setSelectedReturn] = useState<any | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<'COLLECTED' | 'REPLACED' | 'CREDITED'>('COLLECTED');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [signOffLoading, setSignOffLoading] = useState(false);

  // Fetch projects
  useEffect(() => {
    supabase.from('projects').select('id, project_number, name').eq('is_active', true).then(({ data }) => {
      if (data) setProjects(data);
    });
  }, []);

  // Compute KPIs
  useEffect(() => {
    supabase.from('grns').select('id', { count: 'exact' }).eq('is_active', true).then(gRes => {
      supabase.from('grn_items').select('qty_rejected').gt('qty_rejected', 0).then(iRes => {
        supabase.from('grn_returns').select('id').eq('status', 'PENDING_COLLECTION').then(rRes => {
          setKpis({
            totalReceipts: gRes.count || 0,
            rejectionsYTD: iRes.data?.length || 0,
            activeReturns: rRes.data?.length || 0
          });
        });
      });
    });
  }, [grns, returns]);

  const handleResolveReturn = async () => {
    if (!selectedReturn) return;
    try {
      setSignOffLoading(true);
      await updateReturnStatus(selectedReturn.id, resolutionStatus, resolutionNotes);
      setSelectedReturn(null);
      setResolutionNotes('');
    } catch (err) {
      console.error('Failed to resolve return ticket:', err);
    } finally {
      setSignOffLoading(false);
    }
  };

  // Filter lists based on search and project
  const filteredGRNs = grns.filter(g => {
    const matchesSearch = 
      g.grn_number.toLowerCase().includes(searchQuery.toLowerCase()) || 
      g.delivery_note_ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.po_number && g.po_number.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesProject = !selectedProjectId || g.project_id === selectedProjectId;
    
    return matchesSearch && matchesProject;
  });

  const filteredReturns = returns.filter(r => {
    const matchesSearch = 
      (r.grn_number && r.grn_number.toLowerCase().includes(searchQuery.toLowerCase())) || 
      (r.po_number && r.po_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.supplier_name && r.supplier_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.item_description && r.item_description.toLowerCase().includes(searchQuery.toLowerCase()));
      
    return matchesSearch;
  });

  const handleRefresh = () => {
    refetchGRNs();
    refetchReturns();
  };

  return (
    <div className="comp-container">
      {/* Header */}
      <header className="comp-header">
        <div>
          <h1 className="comp-header-title">Goods Receipt (GRN) & Returns</h1>
          <p className="comp-header-subtitle">Site material tracking, partial-delivery tolerance checks & damage rejections</p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.8rem' }}>
          <Link href="/procurement/grn/receivables" className="quote-btn quote-btn-secondary">
            <PackageCheck size={16} style={{ marginRight: '0.4rem' }} /> Receivables
          </Link>
          <Link href="/procurement/po" className="quote-btn quote-btn-secondary">
            <FileText size={16} style={{ marginRight: '0.4rem' }} /> Purchase Orders (LPO)
          </Link>
          <Link href="/procurement/grn/create" className="quote-btn quote-btn-primary">
            <Plus size={16} /> Record Goods Receipt
          </Link>
        </div>
      </header>

      {/* KPIs */}
      <div className="proc-kpis">
        <div className="proc-kpi-card">
          <span className="proc-kpi-title">Total Receipts YTD</span>
          <span className="proc-kpi-value">{kpis.totalReceipts}</span>
          <span className="proc-kpi-desc">Logged goods receipt notes</span>
        </div>
        <div className="proc-kpi-card">
          <span className="proc-kpi-title">Damage Rejections</span>
          <span className="proc-kpi-value" style={{ color: '#ef4444' }}>{kpis.rejectionsYTD}</span>
          <span className="proc-kpi-desc">Items flagged as defective on receipt</span>
        </div>
        <div className="proc-kpi-card">
          <span className="proc-kpi-title">Active Returns Pending</span>
          <span className="proc-kpi-value" style={{ color: 'var(--warning)' }}>{kpis.activeReturns}</span>
          <span className="proc-kpi-desc">Awaiting supplier pick-up/credit</span>
        </div>
      </div>

      {/* Tabs Menu */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.2rem' }}>
        <button 
          onClick={() => setActiveTab('GRN')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'GRN' ? 'var(--primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'GRN' ? '2px solid var(--primary)' : 'none',
            padding: '0.8rem 1.2rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
            transition: 'var(--transition-fast)'
          }}
        >
          Goods Receipts (GRN)
        </button>
        <button 
          onClick={() => setActiveTab('RETURNS')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'RETURNS' ? 'var(--primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'RETURNS' ? '2px solid var(--primary)' : 'none',
            padding: '0.8rem 1.2rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
            transition: 'var(--transition-fast)'
          }}
        >
          Supplier Returns Tracker ({kpis.activeReturns})
        </button>
      </div>

      {/* Search and Project filter */}
      <div className="quote-card">
        <div className="quote-filters-bar">
          <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="quote-filter-input"
              placeholder={activeTab === 'GRN' ? "Search GRN number, LPO reference..." : "Search return, LPO, supplier..."}
              style={{ paddingLeft: '2.2rem', width: '100%' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {activeTab === 'GRN' && (
            <select
              className="quote-filter-input"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              style={{ minWidth: '200px' }}
            >
              <option value="">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.project_number} - {p.name}</option>
              ))}
            </select>
          )}

          <button className="quote-btn quote-btn-secondary" onClick={handleRefresh}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Main Lists Card */}
      <div className="quote-card">
        {activeTab === 'GRN' ? (
          // Goods Receipt Lists
          grnLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
              <p>Loading goods receipts...</p>
            </div>
          ) : filteredGRNs.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Truck size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
              <p>No Goods Receipts recorded matching the query.</p>
            </div>
          ) : (
            <div className="quote-table-wrap">
              <table className="quote-table">
                <thead>
                  <tr>
                    <th>GRN Number</th>
                    <th>Date</th>
                    <th>PO Reference</th>
                    <th>Project</th>
                    <th>Delivery Note Ref</th>
                    <th>Location</th>
                    <th>Received By</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGRNs.map(g => (
                    <tr key={g.id}>
                      <td style={{ fontWeight: 600, color: 'var(--secondary)' }}>{g.grn_number}</td>
                      <td>{new Date(g.received_at).toLocaleDateString('en-GB')}</td>
                      <td>
                        <Link href={`/procurement/po/${g.po_id}`} style={{ color: 'var(--primary)' }}>
                          {g.po_number}
                        </Link>
                      </td>
                      <td>
                        {g.project_name ? (
                          <div>
                            <span style={{ fontFamily: 'var(--font-mono)' }}>{g.project_number}</span>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{g.project_name}</div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>OVERHEAD</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 500 }}>{g.delivery_note_ref}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.8rem' }}>
                          <MapPin size={10} style={{ color: 'var(--text-muted)' }} />
                          {GRN_LOCATION_LABELS[g.location]}
                        </span>
                      </td>
                      <td>{g.receiver_name}</td>
                      <td style={{ textAlign: 'center' }}>
                        <Link href={`/procurement/grn/${g.id}`} className="quote-btn quote-btn-secondary" style={{ padding: '0.3rem 0.6rem' }}>
                          <Eye size={12} /> View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          // Returns Tracker List
          retLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
              <p>Loading supplier returns...</p>
            </div>
          ) : filteredReturns.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <AlertOctagon size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
              <p>No supplier returns found.</p>
            </div>
          ) : (
            <div className="quote-table-wrap">
              <table className="quote-table">
                <thead>
                  <tr>
                    <th>Return Ticket</th>
                    <th>Supplier</th>
                    <th>LPO Reference</th>
                    <th>Item Description</th>
                    <th style={{ textAlign: 'right' }}>Rejected Qty</th>
                    <th>Rejection Reason</th>
                    <th>Expected Collection Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReturns.map(r => {
                    const statusColors = GRN_RETURN_STATUS_COLORS[r.status] || { bg: 'var(--surface-hover)', text: '#fff' };
                    
                    return (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600, color: 'var(--secondary)', fontFamily: 'var(--font-mono)' }}>RET-{r.id.substring(0, 8).toUpperCase()}</td>
                        <td style={{ fontWeight: 500 }}>{r.supplier_name}</td>
                        <td>{r.po_number}</td>
                        <td>{r.item_description} <span style={{ color: 'var(--text-secondary)' }}>({r.unit})</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--error)' }}>{r.qty}</td>
                        <td>{(GRN_REJECTION_REASONS as Record<string, string>)[r.reason as string] || r.reason}</td>
                        <td>{r.expected_resolution_date ? new Date(r.expected_resolution_date).toLocaleDateString('en-GB') : '-'}</td>
                        <td>
                          <span 
                            style={{
                              padding: '0.2rem 0.6rem',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              background: statusColors.bg,
                              color: statusColors.text,
                            }}
                          >
                            {GRN_RETURN_STATUS_LABELS[r.status]}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {r.status === 'PENDING_COLLECTION' ? (
                            <button 
                              className="quote-btn quote-btn-primary" 
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                              onClick={() => setSelectedReturn(r)}
                            >
                              Resolve Ticket
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              Resolved on {r.resolved_at ? new Date(r.resolved_at).toLocaleDateString('en-GB') : '-'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Resolve Return Ticket Modal */}
      {selectedReturn && (
        <div className="quote-modal-overlay">
          <div className="quote-modal" style={{ maxWidth: '450px' }}>
            <div className="quote-modal-header">
              <h3 className="quote-card-title">Resolve Return Ticket</h3>
              <button 
                className="quote-btn" 
                style={{ background: 'transparent', fontSize: '1.2rem', color: '#fff' }} 
                onClick={() => setSelectedReturn(null)}
              >
                &times;
              </button>
            </div>
            <div className="quote-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'var(--surface-hover)', padding: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Item & Supplier</div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: '0.2rem' }}>
                  {selectedReturn.item_description} ({selectedReturn.qty} {selectedReturn.unit})
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '0.1rem' }}>
                  Supplier: {selectedReturn.supplier_name}
                </div>
              </div>

              <div>
                <label className="quote-input-label">Resolution Actions</label>
                <select 
                  className="quote-filter-input"
                  style={{ width: '100%' }}
                  value={resolutionStatus}
                  onChange={(e: any) => setResolutionStatus(e.target.value)}
                >
                  <option value="COLLECTED">Collected by Supplier (Credit Note Pending)</option>
                  <option value="REPLACED">Items Replaced by Supplier (Passed Inspection)</option>
                  <option value="CREDITED">Credit Note Received (Closed Ticket)</option>
                </select>
              </div>

              <div>
                <label className="quote-input-label">Resolution Details / Remarks</label>
                <textarea
                  className="quote-filter-input"
                  style={{ width: '100%', minHeight: '80px', padding: '0.6rem', resize: 'vertical' }}
                  placeholder="Enter invoice credit ref, replacement delivery note ref, or inspection comments..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
                <button className="quote-btn quote-btn-secondary" onClick={() => setSelectedReturn(null)}>
                  Dismiss
                </button>
                <button 
                  className="quote-btn quote-btn-primary" 
                  onClick={handleResolveReturn}
                  disabled={signOffLoading}
                >
                  {signOffLoading ? <RefreshCw size={14} className="spinner" /> : null} Sign Off Resolution
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
