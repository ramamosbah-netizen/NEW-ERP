// ============================================================
// JEET ERP — AMC Contracts Master Registry
// Route: /amc
// ============================================================

'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Plus, 
  Search, 
  RefreshCw, 
  Eye, 
  FileText, 
  ShieldCheck, 
  AlertTriangle, 
  DollarSign, 
  Layers
} from 'lucide-react';
import { useAMCContracts } from '@/hooks/useAMCContracts';
import { AMC_STATUS_LABELS, AMC_STATUS_COLORS, AMC_TYPE_LABELS } from '@/constants/amc.constants';
import type { AMCContractStatus } from '@/types/amc.types';

const fmtAED = (v: number) => {
  return new Intl.NumberFormat('en-AE', { 
    style: 'currency', 
    currency: 'AED', 
    minimumFractionDigits: 2 
  }).format(v);
};

export default function AMCRegistryPage() {
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    clientId: ''
  });

  const { contracts, loading, error, refetch } = useAMCContracts(filters);

  // Compute KPI metrics based on retrieved contracts
  const metrics = useMemo(() => {
    const active = contracts.filter(c => c.status === 'ACTIVE');
    const expiring = contracts.filter(c => c.status === 'EXPIRING');
    const expired = contracts.filter(c => c.status === 'EXPIRED');
    const totalValue = active.reduce((sum, c) => sum + Number(c.annual_value), 0);
    const SIRA = contracts.filter(c => c.sira_linked && c.status === 'ACTIVE').length;

    return {
      activeCount: active.length,
      expiringCount: expiring.length + expired.length,
      totalPortfolioValue: totalValue,
      siraLinkedCount: SIRA
    };
  }, [contracts]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="quote-container">
      {/* Header */}
      <header className="quote-header">
        <div>
          <h1 className="quote-header-title">Annual Maintenance Contracts (AMC)</h1>
          <p className="quote-header-subtitle">JEET ERP Centralized Service SLA Contracts Registry & SIRA Links</p>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          <Link href="/amc/renewal" className="quote-btn quote-btn-secondary" style={{ textDecoration: 'none' }}>
            <Layers size={14} /> Renewal Kanban
          </Link>
          <Link href="/amc/create" className="quote-btn quote-btn-primary" style={{ textDecoration: 'none' }}>
            <Plus size={16} /> New Contract
          </Link>
        </div>
      </header>

      {/* KPI Dashboard Grid */}
      <div className="quote-form-grid" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {/* Metric 1: Portfolio Value */}
        <div className="quote-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: 0 }}>
          <div style={{ padding: '0.8rem', borderRadius: '8px', background: 'rgba(0, 229, 160, 0.1)', color: 'var(--primary)' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Active Portfolio Value</p>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.2rem' }}>
              {fmtAED(metrics.totalPortfolioValue)}
            </h3>
          </div>
        </div>

        {/* Metric 2: Active Contracts */}
        <div className="quote-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: 0 }}>
          <div style={{ padding: '0.8rem', borderRadius: '8px', background: 'rgba(34, 211, 238, 0.1)', color: 'var(--secondary)' }}>
            <FileText size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Active Contracts</p>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.2rem' }}>
              {metrics.activeCount}
            </h3>
          </div>
        </div>

        {/* Metric 3: Expiring & Critical */}
        <div className="quote-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: 0 }}>
          <div style={{ padding: '0.8rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Expiring / Expired</p>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.2rem' }}>
              {metrics.expiringCount}
            </h3>
          </div>
        </div>

        {/* Metric 4: SIRA Connections */}
        <div className="quote-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: 0 }}>
          <div style={{ padding: '0.8rem', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.1)', color: 'var(--accent)' }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>SIRA Regulated Active</p>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.2rem' }}>
              {metrics.siraLinkedCount}
            </h3>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="quote-card">
        <div className="quote-filters-bar" style={{ marginBottom: 0, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              name="search"
              className="quote-filter-input"
              style={{ paddingLeft: '2.4rem', width: '100%' }}
              placeholder="Search by contract number, client name, site..."
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
            {Object.entries(AMC_STATUS_LABELS).map(([status, label]) => (
              <option key={status} value={status}>{label}</option>
            ))}
          </select>

          <button type="button" className="quote-btn quote-btn-secondary" onClick={refetch}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Table Area */}
      {loading ? (
        <div className="quote-card" style={{ textAlign: 'center', padding: '4rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1.5rem auto' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading contracts registry...</p>
        </div>
      ) : error ? (
        <div className="quote-card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--error)' }}>
          <p>Failed to load AMC Contracts: {error.message}</p>
        </div>
      ) : contracts.length === 0 ? (
        <div className="quote-card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <FileText size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.2 }} />
          <p>No AMC contracts found matching filters.</p>
        </div>
      ) : (
        <div className="quote-card" style={{ padding: 0 }}>
          <div className="quote-table-wrap">
            <table className="quote-table">
              <thead>
                <tr>
                  <th>Contract No</th>
                  <th>Client</th>
                  <th>Site / Location</th>
                  <th>Type</th>
                  <th>Systems</th>
                  <th>Annual Value</th>
                  <th>Frequency</th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => {
                  const colors = AMC_STATUS_COLORS[c.status as AMCContractStatus] || AMC_STATUS_COLORS.DRAFT;
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--secondary)' }}>
                        <Link href={`/amc/${c.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          {c.contract_number}
                        </Link>
                      </td>
                      <td style={{ fontWeight: 600 }}>{c.client_name}</td>
                      <td>
                        <div style={{ fontSize: '0.85rem' }}>{c.site_name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.site_address} ({c.emirate})</div>
                      </td>
                      <td style={{ fontSize: '0.78rem' }}>{AMC_TYPE_LABELS[c.contract_type] || c.contract_type}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                          {c.systems.map(sys => (
                            <span 
                              key={sys} 
                              style={{ 
                                fontSize: '0.68rem', 
                                background: 'rgba(255,255,255,0.04)', 
                                border: '1px solid rgba(255,255,255,0.06)', 
                                borderRadius: '4px', 
                                padding: '1px 4px',
                                fontFamily: 'var(--font-mono)' 
                              }}
                            >
                              {sys}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                        {fmtAED(c.annual_value)}
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {c.billing_frequency.replace('_', ' ')}
                      </td>
                      <td>
                        {new Date(c.end_date).toLocaleDateString('en-GB')}
                      </td>
                      <td>
                        <span 
                          className="q-badge" 
                          style={{ 
                            background: colors.bg, 
                            color: colors.text, 
                            borderColor: colors.border 
                          }}
                        >
                          {AMC_STATUS_LABELS[c.status] || c.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Link href={`/amc/${c.id}`} className="quote-btn quote-btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
                          <Eye size={12} /> View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
