// ============================================================
// JEET ERP — PPM Scheduling Calendar Dashboard
// Route: /ppm/calendar
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Calendar as CalendarIcon, 
  User, 
  MapPin, 
  Clock, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  ChevronRight,
  Filter
} from 'lucide-react';
import { usePPMVisits } from '@/hooks/usePPMVisits';
import { supabase } from '@/lib/supabase';
import { PPM_VISIT_STATUS_LABELS, PPM_VISIT_STATUS_COLORS } from '@/constants/amc.constants';

export default function PPMCalendarPage() {
  const [filters, setFilters] = useState({
    status: '',
    technicianId: '',
    date: ''
  });

  const { visits, loading, error, refetch } = usePPMVisits(filters);
  const [techs, setTechs] = useState<any[]>([]);

  // Load tech dropdown
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['technician', 'engineer'])
      .then(({ data }) => {
        if (data) setTechs(data);
      });
  }, []);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  // Group visits into Scheduled vs Unscheduled
  const unscheduledVisits = visits.filter(v => v.status === 'UNSCHEDULED');
  const scheduledVisits = visits.filter(v => v.status !== 'UNSCHEDULED');

  return (
    <div className="quote-container">
      {/* Header */}
      <header className="quote-header">
        <div>
          <h1 className="quote-header-title">PPM Maintenance Scheduler</h1>
          <p className="quote-header-subtitle">JEET ERP Operations Planned Preventive Maintenance Dispatch Board</p>
        </div>
      </header>

      {/* Filter panel */}
      <div className="quote-card">
        <div className="quote-filters-bar" style={{ marginBottom: 0, alignItems: 'center' }}>
          
          {/* Tech Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              name="technicianId"
              className="quote-filter-input"
              value={filters.technicianId}
              onChange={handleFilterChange}
              style={{ minWidth: '180px' }}
            >
              <option value="">All Technicians</option>
              {techs.map(t => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            name="status"
            className="quote-filter-input"
            value={filters.status}
            onChange={handleFilterChange}
            style={{ minWidth: '150px' }}
          >
            <option value="">All Statuses</option>
            {Object.entries(PPM_VISIT_STATUS_LABELS).map(([status, label]) => (
              <option key={status} value={status}>{label}</option>
            ))}
          </select>

          {/* Date Filter */}
          <input
            type="date"
            name="date"
            className="quote-filter-input"
            value={filters.date}
            onChange={handleFilterChange}
          />

          <button type="button" className="quote-btn quote-btn-secondary" onClick={refetch}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Main Board Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left: Scheduled visits Board */}
        <div className="quote-card" style={{ minHeight: '60vh' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CalendarIcon size={20} style={{ color: 'var(--primary)' }} /> Scheduled Visits Timeline
          </h2>

          {loading ? (
            <div style={{ padding: '4rem', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
              <p>Loading dispatch timeline...</p>
            </div>
          ) : error ? (
            <p style={{ color: 'var(--error)' }}>Failed to load visits: {error.message}</p>
          ) : scheduledVisits.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              <CalendarIcon size={40} style={{ margin: '0 auto 0.8rem auto', opacity: 0.15 }} />
              <p>No scheduled visits matching query. Drag/schedule items from the sidebar.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {scheduledVisits.map((v) => {
                const colors = PPM_VISIT_STATUS_COLORS[v.status] || PPM_VISIT_STATUS_COLORS.SCHEDULED;
                return (
                  <div 
                    key={v.id}
                    style={{ 
                      padding: '1.2rem', 
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}
                  >
                    <div>
                      {/* Visit details */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--secondary)' }}>{v.visit_number}</span>
                        <span 
                          style={{ 
                            fontSize: '0.65rem', 
                            fontWeight: 700, 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            background: colors.bg,
                            color: colors.text,
                            border: `1px solid ${colors.border}`
                          }}
                        >
                          {PPM_VISIT_STATUS_LABELS[v.status]}
                        </span>
                      </div>
                      
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginTop: '0.4rem' }}>{v.client_name}</h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}>
                        <MapPin size={12} /> {v.site_name} | {v.site_address}
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* Schedule info */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <CalendarIcon size={12} style={{ color: 'var(--text-muted)' }} />
                          <span>{v.scheduled_date ? new Date(v.scheduled_date).toLocaleDateString('en-GB') : '—'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                          <span>Slot: {v.scheduled_slot}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <User size={12} style={{ color: 'var(--text-muted)' }} />
                          <span>Tech: {v.technician_name || 'Unassigned'}</span>
                        </div>
                      </div>

                      {/* Link actions */}
                      <div>
                        {v.status === 'COMPLETED' ? (
                          <Link href={`/amc/${v.contract_id}`} className="quote-btn quote-btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', textDecoration: 'none' }}>
                            View Contract
                          </Link>
                        ) : (
                          <Link href={`/ppm/execute/${v.id}`} className="quote-btn quote-btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', textDecoration: 'none' }}>
                            Execute Visit <ChevronRight size={12} />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Unscheduled backlog sidebar */}
        <div className="quote-card" style={{ padding: '1.2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Unscheduled Backlog</span>
            <span style={{ fontSize: '0.75rem', background: 'rgba(239,68,68,0.1)', color: 'var(--error)', padding: '2px 6px', borderRadius: '4px' }}>
              {unscheduledVisits.length}
            </span>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '65vh', overflowY: 'auto' }}>
            {unscheduledVisits.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>All PPM visits scheduled!</p>
            ) : (
              unscheduledVisits.map((v) => {
                const targetMonth = new Date(v.target_month);
                const monthStr = targetMonth.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
                return (
                  <div 
                    key={v.id}
                    style={{ 
                      padding: '0.8rem', 
                      background: 'rgba(0,0,0,0.25)', 
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--secondary)' }}>{v.visit_number}</span>
                      <span style={{ color: 'var(--warning)', fontWeight: 600 }}>Target: {monthStr}</span>
                    </div>

                    <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fff' }}>{v.client_name}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Site: {v.site_name}</p>

                    <Link 
                      href={`/amc/${v.contract_id}`}
                      className="quote-btn quote-btn-secondary"
                      style={{ 
                        padding: '0.3rem', 
                        fontSize: '0.72rem', 
                        marginTop: '0.4rem', 
                        width: '100%',
                        textDecoration: 'none',
                        textAlign: 'center'
                      }}
                    >
                      Schedule Triage
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
