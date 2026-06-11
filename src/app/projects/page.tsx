// ============================================================
// JEET ERP — Projects List Dashboard Registry
// Route: /projects
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  ArrowRight,
  Eye,
  RefreshCw,
  LayoutGrid,
  Layers,
  Briefcase
} from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { ProjectKPICards } from '@/components/projects/ProjectKPICards';
import { ProjectsKanban } from '@/components/projects/ProjectsKanban';
import { ProjectStatusChip } from '@/components/projects/ProjectStatusChip';

const fmtAED = (v: number) => {
  return 'AED ' + new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};

export default function ProjectsListPage() {
  const [tabMode, setTabMode] = useState<'registry' | 'pipeline'>('registry');
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [filters, setFilters] = useState<any>({
    status: '',
    emirate: '',
    search: '',
    project_manager_id: '',
    include_pre_award: false
  });

  const { projects, loading, error, refetch } = useProjects(filters);
  const [pms, setPms] = useState<any[]>([]);

  // Fetch list of PMs for dropdown
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['manager', 'admin'])
      .then(({ data }) => {
        if (data) setPms(data);
      });
  }, []);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleTabChange = (tab: 'registry' | 'pipeline') => {
    setTabMode(tab);
    setFilters((prev: any) => ({
      ...prev,
      status: '',
      include_pre_award: tab === 'pipeline'
    }));
  };

  // Compute Pipeline & Win-rate stats
  const totalSubmitted = projects.filter((p) => p.status === 'SUBMITTED').length;
  const wonCount = projects.filter((p) => !['SUBMITTED', 'LOST', 'CANCELLED'].includes(p.status)).length;
  const lostCount = projects.filter((p) => p.status === 'LOST').length;
  const totalConcluded = wonCount + lostCount;
  const winRatePercent = totalConcluded > 0 ? Math.round((wonCount / totalConcluded) * 100) : 0;

  // Filter display list
  const displayList = tabMode === 'pipeline'
    ? projects.filter((p) => ['SUBMITTED', 'LOST'].includes(p.status))
    : projects;

  return (
    <div className="quote-container">
      {/* Header */}
      <header className="quote-header">
        <div>
          <h1 className="quote-header-title">Projects Master Registry</h1>
          <p className="quote-header-subtitle">JEET ERP Centralized project contracts and status control board</p>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          
          {/* View Toggles */}
          {tabMode === 'registry' && (
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '2px' }}>
              <button 
                type="button"
                onClick={() => setViewMode('table')}
                style={{
                  background: viewMode === 'table' ? 'var(--primary)' : 'transparent',
                  color: viewMode === 'table' ? '#060814' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.4rem 0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  transition: 'var(--transition-fast)'
                }}
              >
                <LayoutGrid size={14} /> List View
              </button>
              <button 
                type="button"
                onClick={() => setViewMode('kanban')}
                style={{
                  background: viewMode === 'kanban' ? 'var(--primary)' : 'transparent',
                  color: viewMode === 'kanban' ? '#060814' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.4rem 0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  transition: 'var(--transition-fast)'
                }}
              >
                <Layers size={14} /> Kanban Board
              </button>
            </div>
          )}

          <Link href="/projects/new" className="quote-btn quote-btn-primary" style={{ textDecoration: 'none' }}>
            <Plus size={16} /> Initialize Project
          </Link>
        </div>
      </header>

      {/* Tab selectors */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '1.5rem' }}>
        <button 
          onClick={() => handleTabChange('registry')}
          className={`quote-tab ${tabMode === 'registry' ? 'active' : ''}`}
          style={{ background: 'transparent', padding: '0.6rem 1.2rem', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer' }}
        >
          Execution Registry
        </button>
        <button 
          onClick={() => handleTabChange('pipeline')}
          className={`quote-tab ${tabMode === 'pipeline' ? 'active' : ''}`}
          style={{ background: 'transparent', padding: '0.6rem 1.2rem', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer' }}
        >
          Pipeline & Win-Rate
        </button>
      </div>

      {/* KPI Cards Strip */}
      {!loading && !error && (
        tabMode === 'pipeline' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.2rem', marginBottom: '1.8rem' }}>
            <div className="quote-card" style={{ margin: 0, borderLeft: '4px solid var(--secondary)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Active Pipeline
                </span>
                <Briefcase size={18} style={{ color: 'var(--secondary)' }} />
              </div>
              <div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff' }}>{totalSubmitted}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Awaiting client approval decision</div>
              </div>
            </div>

            <div className="quote-card" style={{ margin: 0, borderLeft: '4px solid #00E5A0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Opportunities Won
                </span>
                <Plus size={18} style={{ color: '#00E5A0' }} />
              </div>
              <div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#00E5A0' }}>{wonCount}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Advanced to execution stage</div>
              </div>
            </div>

            <div className="quote-card" style={{ margin: 0, borderLeft: '4px solid var(--error)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Opportunities Lost
                </span>
                <Layers size={18} style={{ color: 'var(--error)' }} />
              </div>
              <div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ffffff' }}>{lostCount}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Quotation rejected / opportunity lost</div>
              </div>
            </div>

            <div className="quote-card" style={{ margin: 0, borderLeft: '4px solid var(--primary)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Win Rate Ratio
                </span>
                <Plus size={18} style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)' }}>{winRatePercent}%</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Concluded bids success rate</div>
              </div>
            </div>
          </div>
        ) : (
          <ProjectKPICards projects={projects} />
        )
      )}

      {/* Filters Card */}
      <div className="quote-card">
        <div className="quote-filters-bar" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', flex: 1, gap: '1rem', minWidth: '300px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                name="search"
                className="quote-filter-input"
                placeholder="Search project number, title, client name..."
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
            {tabMode === 'pipeline' ? (
              <>
                <option value="">All Pipeline</option>
                <option value="SUBMITTED">Submitted (Pre-Award)</option>
                <option value="LOST">Lost Opportunity</option>
              </>
            ) : (
              <>
                <option value="">All Statuses</option>
                <option value="MOBILIZATION">Mobilization</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="TESTING">Testing & Commissioning</option>
                <option value="HANDOVER">Handover</option>
                <option value="DLP">DLP (Warranty)</option>
                <option value="CLOSED">Closed</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="CANCELLED">Cancelled</option>
              </>
            )}
          </select>

          <select
            name="emirate"
            className="quote-filter-input"
            value={filters.emirate}
            onChange={handleFilterChange}
          >
            <option value="">All Locations</option>
            <option value="DUBAI">Dubai</option>
            <option value="ABU_DHABI">Abu Dhabi</option>
            <option value="SHARJAH">Sharjah</option>
            <option value="AJMAN">Ajman</option>
            <option value="RAK">Ras Al Khaimah</option>
            <option value="FUJAIRAH">Fujairah</option>
            <option value="UAQ">Umm Al Quwain</option>
          </select>

          {tabMode === 'registry' && (
            <select
              name="project_manager_id"
              className="quote-filter-input"
              value={filters.project_manager_id}
              onChange={handleFilterChange}
            >
              <option value="">All Managers</option>
              {pms.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          )}

          <button className="quote-btn quote-btn-secondary" onClick={refetch}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Main List Area */}
      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center' }} className="quote-card">
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
          <p>Loading projects master registry...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }} className="quote-card">
          <p>Error loading projects: {error.message}</p>
        </div>
      ) : tabMode === 'registry' && viewMode === 'kanban' ? (
        <ProjectsKanban projects={displayList} />
      ) : displayList.length === 0 ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }} className="quote-card">
          <Briefcase size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
          <p>No projects found matching selection criteria</p>
        </div>
      ) : (
        <div className="quote-card">
          <div className="quote-table-wrap">
            <table className="quote-table">
              <thead>
                <tr>
                  <th>Project ID</th>
                  <th>Project Name</th>
                  <th>Client Name</th>
                  <th>Location</th>
                  {tabMode === 'registry' ? (
                    <>
                      <th>Type</th>
                      <th>Value</th>
                    </>
                  ) : (
                    <>
                      <th>Systems</th>
                      <th>Lost Reason / Details</th>
                    </>
                  )}
                  <th>Status</th>
                  <th>Start Date</th>
                  <th>End/Target Date</th>
                  <th style={{ textAlign: 'center' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {displayList.map((proj) => (
                  <tr key={proj.id}>
                    <td style={{ fontWeight: 700, color: 'var(--secondary)', fontFamily: 'var(--font-mono)' }}>
                      <Link href={`/projects/${proj.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {proj.project_number}
                      </Link>
                    </td>
                    <td style={{ fontWeight: 600 }}>{proj.name}</td>
                    <td>{proj.client_name}</td>
                    <td>{proj.emirate}</td>
                    {tabMode === 'registry' ? (
                      <>
                        <td style={{ fontSize: '0.78rem' }}>{proj.project_type.replace('_', ' ')}</td>
                        <td style={{ fontWeight: 600, color: '#00E5A0' }}>{fmtAED(proj.contract_value)}</td>
                      </>
                    ) : (
                      <>
                        <td style={{ fontSize: '0.78rem' }}>{(proj.systems || []).join(', ')}</td>
                        <td style={{ fontSize: '0.78rem', color: proj.status === 'LOST' ? 'var(--error)' : 'var(--text-secondary)' }}>
                          {proj.status === 'LOST' ? (proj.cancel_reason || 'Rejection reason unspecified') : 'Awaiting client decision'}
                        </td>
                      </>
                    )}
                    <td>
                      <ProjectStatusChip status={proj.status} />
                    </td>
                    <td>{proj.start_date ? new Date(proj.start_date).toLocaleDateString('en-GB') : '—'}</td>
                    <td>{proj.planned_end_date ? new Date(proj.planned_end_date).toLocaleDateString('en-GB') : '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <Link href={`/projects/${proj.id}`} className="quote-btn quote-btn-secondary" style={{ padding: '0.3rem 0.6rem' }}>
                        <Eye size={12} /> View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
