// ============================================================
// JEET ERP — Purchase Orders (LPO) Dashboard Registry
// Route: /procurement/po
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { usePOs } from '@/hooks/usePOs';
import { PO_STATUS_LABELS, PO_STATUS_COLORS, PO_TYPE_LABELS } from '@/constants/po.constants';
import { 
  Plus, 
  Search, 
  FileText, 
  Calendar, 
  Eye, 
  RefreshCw, 
  Layers, 
  TrendingUp, 
  DollarSign, 
  CheckCircle,
  Truck
} from 'lucide-react';
import '@/app/procurement/comparisons/comparisons.css'; // Reuse obsidian design CSS rules

const fmtAED = (v: number) => {
  return 'AED ' + new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

export default function PORegistryPage() {
  const [filters, setFilters] = useState<any>({
    status: '',
    search: '',
    project_id: '',
    po_type: ''
  });

  const { pos, loading, error, refetch } = usePOs(filters);
  const [projects, setProjects] = useState<any[]>([]);
  const [kpis, setKpis] = useState({
    totalCount: 0,
    totalCommitted: 0,
    pendingDeliveries: 0,
    activeDrafts: 0
  });

  // Fetch projects list for dropdown filter
  useEffect(() => {
    supabase.from('projects').select('id, project_number, name').eq('is_active', true).then(({ data }) => {
      if (data) setProjects(data);
    });
  }, []);

  // Compute KPIs from POS
  useEffect(() => {
    supabase.from('purchase_orders').select('*').eq('is_active', true).then(({ data }) => {
      if (data) {
        const count = data.length;
        const total = data
          .filter(p => !['DRAFT', 'CANCELLED', 'REJECTED'].includes(p.status))
          .reduce((sum, p) => sum + (Number(p.total) || 0), 0);
        const pending = data.filter(p => ['APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED'].includes(p.status)).length;
        const drafts = data.filter(p => p.status === 'DRAFT').length;

        setKpis({
          totalCount: count,
          totalCommitted: total,
          pendingDeliveries: pending,
          activeDrafts: drafts
        });
      }
    });
  }, [pos]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev: any) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="comp-container">
      {/* Header */}
      <header className="comp-header">
        <div>
          <h1 className="comp-header-title">Local Purchase Order (LPO) Registry</h1>
          <p className="comp-header-subtitle">Central committed-cost ledger, supplier contract issuance & delivery tracking</p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.8rem' }}>
          <Link href="/procurement/grn" className="quote-btn quote-btn-secondary">
            <Truck size={16} style={{ marginRight: '0.4rem' }} /> Goods Receipts (GRN)
          </Link>
          <Link href="/procurement/po/create" className="quote-btn quote-btn-primary">
            <Plus size={16} /> New LPO
          </Link>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="proc-kpis">
        <div className="proc-kpi-card">
          <span className="proc-kpi-title">Total Orders YTD</span>
          <span className="proc-kpi-value">{kpis.totalCount}</span>
          <span className="proc-kpi-desc">Drafts & active Purchase Orders</span>
        </div>
        <div className="proc-kpi-card">
          <span className="proc-kpi-title">Committed Cost YTD</span>
          <span className="proc-kpi-value" style={{ color: '#00E5A0' }}>{fmtAED(kpis.totalCommitted)}</span>
          <span className="proc-kpi-desc">Active LPO values (ex-Drafts)</span>
        </div>
        <div className="proc-kpi-card">
          <span className="proc-kpi-title">Deliveries Pending</span>
          <span className="proc-kpi-value" style={{ color: '#22d3ee' }}>{kpis.pendingDeliveries}</span>
          <span className="proc-kpi-desc">POs in shipping / partial receipt</span>
        </div>
        <div className="proc-kpi-card">
          <span className="proc-kpi-title">Active PO Drafts</span>
          <span className="proc-kpi-value" style={{ color: 'var(--warning)' }}>{kpis.activeDrafts}</span>
          <span className="proc-kpi-desc">Awaiting submission or revision</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="quote-card">
        <div className="quote-filters-bar" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              name="search"
              className="quote-filter-input"
              placeholder="Search PO number, supplier name..."
              style={{ paddingLeft: '2.2rem', width: '100%' }}
              value={filters.search}
              onChange={handleFilterChange}
            />
          </div>

          <select
            name="status"
            className="quote-filter-input"
            value={filters.status}
            onChange={handleFilterChange}
            style={{ minWidth: '150px' }}
          >
            <option value="">All Statuses</option>
            {Object.keys(PO_STATUS_LABELS).map(key => (
              <option key={key} value={key}>{PO_STATUS_LABELS[key as keyof typeof PO_STATUS_LABELS]}</option>
            ))}
          </select>

          <select
            name="po_type"
            className="quote-filter-input"
            value={filters.po_type}
            onChange={handleFilterChange}
            style={{ minWidth: '150px' }}
          >
            <option value="">All Types</option>
            {Object.keys(PO_TYPE_LABELS).map(key => (
              <option key={key} value={key}>{PO_TYPE_LABELS[key as keyof typeof PO_TYPE_LABELS]}</option>
            ))}
          </select>

          <select
            name="project_id"
            className="quote-filter-input"
            value={filters.project_id}
            onChange={handleFilterChange}
            style={{ minWidth: '200px' }}
          >
            <option value="">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.project_number} - {p.name}</option>
            ))}
          </select>

          <button className="quote-btn quote-btn-secondary" onClick={refetch}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Table grid */}
      <div className="quote-card">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
            <p style={{ color: 'var(--text-secondary)' }}>Loading purchase orders...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
            <p>Error loading purchase orders: {error.message}</p>
          </div>
        ) : pos.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <FileText size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
            <p>No Purchase Orders found matching the search criteria.</p>
          </div>
        ) : (
          <div className="quote-table-wrap">
            <table className="quote-table">
              <thead>
                <tr>
                  <th>LPO Number</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Project</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Total (AED)</th>
                  <th>Delivery Status</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pos.map(po => {
                  const colors = PO_STATUS_COLORS[po.status] || { bg: 'rgba(255,255,255,0.05)', text: '#fff', border: 'rgba(255,255,255,0.1)' };
                  
                  return (
                    <tr key={po.id}>
                      <td style={{ fontWeight: 600, color: 'var(--secondary)' }}>
                        <Link href={`/procurement/po/${po.id}`}>
                          {po.po_number || 'DRAFT'}
                        </Link>
                      </td>
                      <td>{new Date(po.created_at).toLocaleDateString('en-GB')}</td>
                      <td style={{ fontWeight: 500 }}>{po.supplier_name}</td>
                      <td style={{ fontSize: '0.82rem' }}>
                        {po.po_type === 'OVERHEAD' ? (
                          <span style={{ color: 'var(--text-muted)' }}>OVERHEAD</span>
                        ) : (
                          <div>
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>{po.project_number}</span>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{po.project_name}</div>
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>{PO_TYPE_LABELS[po.po_type]}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtAED(po.total)}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: '100px' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 500 }}>
                            {po.delivery_status === 'COMPLETE' ? 'Fully Delivered' : po.delivery_status === 'PARTIAL' ? 'Partially Delivered' : 'Not Delivered'}
                          </span>
                          <div style={{ height: '4px', width: '100%', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div 
                              style={{ 
                                height: '100%', 
                                width: po.delivery_status === 'COMPLETE' ? '100%' : po.delivery_status === 'PARTIAL' ? '50%' : '0%',
                                background: po.delivery_status === 'COMPLETE' ? '#00E5A0' : po.delivery_status === 'PARTIAL' ? '#f97316' : '#ef4444' 
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span 
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '0.25rem 0.6rem',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            letterSpacing: '0.03em',
                            textTransform: 'uppercase',
                            background: colors.bg,
                            color: colors.text,
                            border: `1px solid ${colors.border}`
                          }}
                        >
                          {PO_STATUS_LABELS[po.status]}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                          <Link href={`/procurement/po/${po.id}`} className="quote-btn quote-btn-secondary" style={{ padding: '0.3rem 0.6rem' }}>
                            <Eye size={12} /> View
                          </Link>
                          {['APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED'].includes(po.status) && (
                            <Link href={`/procurement/grn/create?po_id=${po.id}`} className="quote-btn quote-btn-primary" style={{ padding: '0.3rem 0.6rem', background: 'rgba(34, 211, 238, 0.12)', color: '#22d3ee', borderColor: 'rgba(34, 211, 238, 0.25)' }}>
                              Receive
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
