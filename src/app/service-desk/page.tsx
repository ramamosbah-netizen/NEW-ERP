// ============================================================
// JEET ERP — Service Desk Ticket Board (Kanban + SLA Clocks)
// Route: /service-desk
// ============================================================

'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  RefreshCw,
  Clock,
  User,
  MapPin,
  AlertTriangle,
  Phone,
  Mail,
  Headphones,
  MessageCircle,
  ChevronRight,
  Filter,
  ArrowUpRight,
  Zap,
  Pause,
  Play,
  CheckCircle,
  XCircle,
  Eye,
  LayoutGrid,
  List,
  Timer,
  Shield
} from 'lucide-react';
import { useTickets } from '@/hooks/useTickets';
import { ticketService } from '@/services/ticketService';
import { supabase } from '@/lib/supabase';
import {
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_COLORS,
  TICKET_COVERAGE_LABELS,
  TICKET_INTAKE_LABELS
} from '@/constants/amc.constants';
import type { ServiceTicket, ServiceTicketStatus, TicketPriority } from '@/types/ticket.types';

// --- Kanban column config ---
const KANBAN_COLUMNS: { status: ServiceTicketStatus; label: string; color: string }[] = [
  { status: 'NEW', label: 'New Intake', color: '#0ea5e9' },
  { status: 'ASSIGNED', label: 'Assigned', color: '#a855f7' },
  { status: 'IN_PROGRESS', label: 'In Progress', color: '#eab308' },
  { status: 'ON_HOLD_PARTS', label: 'On Hold', color: '#f97316' },
  { status: 'RESOLVED', label: 'Resolved', color: '#22d3ee' },
  { status: 'CLOSED', label: 'Closed', color: 'var(--accent)' }
];

// --- SLA Clock component ---
function SLAClock({ dueDate, label, met }: { dueDate: string; label: string; met?: boolean | null }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000); // Update every 30s
    return () => clearInterval(interval);
  }, []);

  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const isOverdue = diffMs < 0;
  const absDiff = Math.abs(diffMs);
  const hours = Math.floor(absDiff / (1000 * 60 * 60));
  const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));

  // Color coding
  let timerColor = 'var(--accent)'; // green: >4h remaining
  if (met === true) timerColor = 'var(--accent)';
  else if (met === false || isOverdue) timerColor = '#ef4444';
  else if (hours < 1) timerColor = '#ef4444'; // red: <1h
  else if (hours < 4) timerColor = '#f97316'; // orange: <4h

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.3rem',
      fontSize: '0.65rem',
      fontFamily: 'var(--font-mono)',
      fontWeight: 700,
      color: timerColor
    }}>
      <Timer size={10} />
      <span>{label}: </span>
      {met !== null && met !== undefined ? (
        <span>{met ? '✓ MET' : '✗ BREACH'}</span>
      ) : (
        <span>
          {isOverdue ? '-' : ''}{hours}h {minutes}m
        </span>
      )}
    </div>
  );
}

// --- Intake channel icon ---
function IntakeIcon({ channel }: { channel: string }) {
  const size = 12;
  switch (channel) {
    case 'PHONE': return <Phone size={size} />;
    case 'EMAIL': return <Mail size={size} />;
    case 'WHATSAPP': return <MessageCircle size={size} />;
    default: return <Headphones size={size} />;
  }
}

// --- Ticket Card for Kanban ---
function TicketCard({ ticket, onAssign, onDispatch }: {
  ticket: ServiceTicket;
  onAssign: (id: string) => void;
  onDispatch: (id: string) => void;
}) {
  const priorityColors = TICKET_PRIORITY_COLORS[ticket.priority as TicketPriority] || TICKET_PRIORITY_COLORS.MEDIUM;
  const isActive = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD_PARTS'].includes(ticket.status);

  return (
    <div style={{
      padding: '0.8rem',
      background: 'rgba(0,0,0,0.3)',
      border: '1px solid var(--surface-hover)',
      borderRadius: '8px',
      borderLeft: `3px solid ${priorityColors.text}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      transition: 'all 0.2s ease',
      cursor: 'pointer'
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.background = 'rgba(0,0,0,0.4)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--surface-hover)';
        e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
      }}
    >
      {/* Top row: ticket# + priority */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link
          href={`/service-desk/${ticket.id}`}
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 800,
            fontSize: '0.75rem',
            color: 'var(--secondary)',
            textDecoration: 'none'
          }}
        >
          {ticket.ticket_number}
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span style={{
            fontSize: '0.58rem',
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: '3px',
            background: priorityColors.bg,
            color: priorityColors.text,
            border: `1px solid ${priorityColors.border}`
          }}>
            {ticket.priority}
          </span>
          <IntakeIcon channel={ticket.intake_channel} />
        </div>
      </div>

      {/* Title */}
      <h4 style={{
        fontSize: '0.8rem',
        fontWeight: 600,
        color: '#fff',
        lineHeight: 1.3,
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical'
      }}>
        {ticket.title}
      </h4>

      {/* Client & site */}
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
        {ticket.client_name && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <User size={10} /> {ticket.client_name}
          </span>
        )}
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <MapPin size={10} /> {ticket.site_address?.substring(0, 50)}{(ticket.site_address?.length || 0) > 50 ? '...' : ''}
        </span>
      </div>

      {/* SLA Clocks */}
      {isActive && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.2rem',
          padding: '0.4rem',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '4px'
        }}>
          <SLAClock dueDate={ticket.sla_response_due} label="RSP" met={ticket.response_met ?? null} />
          <SLAClock dueDate={ticket.sla_resolution_due} label="RES" met={ticket.resolution_met ?? null} />
        </div>
      )}

      {/* Tech assignment */}
      {ticket.technician_name && (
        <div style={{
          fontSize: '0.68rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem'
        }}>
          <User size={10} style={{ color: 'var(--primary)' }} />
          <span>{ticket.technician_name}</span>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
        {ticket.status === 'NEW' && (
          <button
            onClick={(e) => { e.stopPropagation(); onAssign(ticket.id); }}
            style={{
              flex: 1,
              padding: '0.35rem',
              fontSize: '0.65rem',
              fontWeight: 700,
              background: 'rgba(168, 85, 247, 0.15)',
              color: '#a855f7',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.25rem'
            }}
          >
            <User size={10} /> Assign
          </button>
        )}
        {ticket.status === 'ASSIGNED' && (
          <button
            onClick={(e) => { e.stopPropagation(); onDispatch(ticket.id); }}
            style={{
              flex: 1,
              padding: '0.35rem',
              fontSize: '0.65rem',
              fontWeight: 700,
              background: 'rgba(234, 179, 8, 0.15)',
              color: '#eab308',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.25rem'
            }}
          >
            <ArrowUpRight size={10} /> Dispatch
          </button>
        )}
        <Link
          href={`/service-desk/${ticket.id}`}
          style={{
            flex: 1,
            padding: '0.35rem',
            fontSize: '0.65rem',
            fontWeight: 700,
            background: 'var(--surface-hover)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--surface-hover)',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.25rem',
            textDecoration: 'none'
          }}
        >
          <Eye size={10} /> Details
        </Link>
      </div>
    </div>
  );
}

// --- Main Service Desk Page ---
export default function ServiceDeskPage() {
  const [filters, setFilters] = useState({
    status: '',
    technicianId: '',
    priority: '',
    search: ''
  });

  const { tickets, loading, error, refetch } = useTickets(filters);
  const [techs, setTechs] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Assignment modal state
  const [assignModal, setAssignModal] = useState<{ open: boolean; ticketId: string }>({ open: false, ticketId: '' });
  const [selectedTech, setSelectedTech] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Load technicians
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['technician', 'engineer', 'admin'])
      .then(({ data }) => {
        if (data) setTechs(data);
      });
  }, []);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  // Group tickets by status for Kanban
  const ticketsByStatus = useMemo(() => {
    const groups: Record<string, ServiceTicket[]> = {};
    KANBAN_COLUMNS.forEach(col => {
      groups[col.status] = tickets.filter(t => t.status === col.status);
    });
    return groups;
  }, [tickets]);

  // KPI metrics
  const metrics = useMemo(() => {
    const active = tickets.filter(t => ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD_PARTS'].includes(t.status));
    const breached = active.filter(t => {
      const resolutionDue = new Date(t.sla_resolution_due);
      return resolutionDue < new Date();
    });
    const emergency = active.filter(t => t.priority === 'EMERGENCY');
    const resolved = tickets.filter(t => t.status === 'RESOLVED');
    return {
      activeCount: active.length,
      breachedCount: breached.length,
      emergencyCount: emergency.length,
      resolvedPendingClose: resolved.length
    };
  }, [tickets]);

  // Handlers
  const handleAssignOpen = (ticketId: string) => {
    setAssignModal({ open: true, ticketId });
    setSelectedTech('');
  };

  const handleAssignConfirm = async () => {
    if (!selectedTech || !assignModal.ticketId) return;
    try {
      setActionLoading(true);
      await ticketService.assignTicket(assignModal.ticketId, selectedTech);
      setAssignModal({ open: false, ticketId: '' });
      refetch();
    } catch (err: any) {
      logger.error('Assignment failed:', err);
      alert('Assignment failed: ' + (err.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDispatch = async (ticketId: string) => {
    if (!confirm('Dispatch technician to site? This starts the SLA response timer.')) return;
    try {
      setActionLoading(true);
      await ticketService.dispatchTechnician(ticketId);
      refetch();
    } catch (err: any) {
      logger.error('Dispatch failed:', err);
      alert('Dispatch failed: ' + (err.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="quote-container">
      {/* Header */}
      <header className="quote-header">
        <div>
          <h1 className="quote-header-title">Service Desk</h1>
          <p className="quote-header-subtitle">JEET ERP Reactive Service Tickets • SLA Monitoring • Dispatch Control</p>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          {/* View mode toggle */}
          <div style={{
            display: 'flex',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '6px',
            border: '1px solid var(--surface-hover)',
            overflow: 'hidden'
          }}>
            <button
              onClick={() => setViewMode('kanban')}
              style={{
                padding: '0.45rem 0.65rem',
                background: viewMode === 'kanban' ? 'rgba(0, 229, 160, 0.15)' : 'transparent',
                color: viewMode === 'kanban' ? 'var(--primary)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.72rem',
                fontWeight: 600
              }}
            >
              <LayoutGrid size={13} /> Board
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '0.45rem 0.65rem',
                background: viewMode === 'list' ? 'rgba(0, 229, 160, 0.15)' : 'transparent',
                color: viewMode === 'list' ? 'var(--primary)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.72rem',
                fontWeight: 600
              }}
            >
              <List size={13} /> List
            </button>
          </div>

          <Link href="/service-desk/new" className="quote-btn quote-btn-primary" style={{ textDecoration: 'none' }}>
            <Plus size={16} /> Log Ticket
          </Link>
        </div>
      </header>

      {/* KPI Dashboard */}
      <div className="quote-form-grid" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="quote-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: 0 }}>
          <div style={{ padding: '0.8rem', borderRadius: '8px', background: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9' }}>
            <Headphones size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Active Tickets</p>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{metrics.activeCount}</h3>
          </div>
        </div>

        <div className="quote-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: 0 }}>
          <div style={{ padding: '0.8rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>SLA Breached</p>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: metrics.breachedCount > 0 ? '#ef4444' : 'var(--text-primary)' }}>{metrics.breachedCount}</h3>
          </div>
        </div>

        <div className="quote-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: 0 }}>
          <div style={{ padding: '0.8rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <Zap size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Emergency</p>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: metrics.emergencyCount > 0 ? '#ef4444' : 'var(--text-primary)' }}>{metrics.emergencyCount}</h3>
          </div>
        </div>

        <div className="quote-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: 0 }}>
          <div style={{ padding: '0.8rem', borderRadius: '8px', background: 'rgba(34, 211, 238, 0.1)', color: '#22d3ee' }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Pending Close</p>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{metrics.resolvedPendingClose}</h3>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="quote-card">
        <div className="quote-filters-bar" style={{ marginBottom: 0, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              name="search"
              className="quote-filter-input"
              style={{ paddingLeft: '2.4rem', width: '100%' }}
              placeholder="Search ticket#, title, site..."
              value={filters.search}
              onChange={handleFilterChange}
            />
          </div>

          <select
            name="priority"
            className="quote-filter-input"
            value={filters.priority}
            onChange={handleFilterChange}
            style={{ minWidth: '130px' }}
          >
            <option value="">All Priorities</option>
            {Object.entries(TICKET_PRIORITY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select
            name="technicianId"
            className="quote-filter-input"
            value={filters.technicianId}
            onChange={handleFilterChange}
            style={{ minWidth: '160px' }}
          >
            <option value="">All Technicians</option>
            {techs.map(t => (
              <option key={t.id} value={t.id}>{t.full_name}</option>
            ))}
          </select>

          <button type="button" className="quote-btn quote-btn-secondary" onClick={() => refetch()}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="quote-card" style={{ textAlign: 'center', padding: '4rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1.5rem auto' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading service desk...</p>
        </div>
      ) : error ? (
        <div className="quote-card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--error)' }}>
          <p>Failed to load tickets: {error.message}</p>
        </div>
      ) : viewMode === 'kanban' ? (
        /* ======= KANBAN BOARD VIEW ======= */
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${KANBAN_COLUMNS.length}, minmax(220px, 1fr))`,
          gap: '0.75rem',
          overflowX: 'auto',
          paddingBottom: '1rem',
          marginTop: '0.5rem'
        }}>
          {KANBAN_COLUMNS.map(col => {
            const columnTickets = ticketsByStatus[col.status] || [];
            return (
              <div key={col.status} style={{
                background: 'var(--surface-hover)',
                borderRadius: '10px',
                border: '1px solid var(--surface-hover)',
                overflow: 'hidden',
                minHeight: '400px',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Column Header */}
                <div style={{
                  padding: '0.75rem 0.8rem',
                  borderBottom: `2px solid ${col.color}20`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: `${col.color}08`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: col.color
                    }} />
                    <span style={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: '#fff'
                    }}>
                      {col.label}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '8px',
                    background: `${col.color}15`,
                    color: col.color,
                    fontFamily: 'var(--font-mono)'
                  }}>
                    {columnTickets.length}
                  </span>
                </div>

                {/* Column Cards */}
                <div style={{
                  flex: 1,
                  padding: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  overflowY: 'auto',
                  maxHeight: '65vh'
                }}>
                  {columnTickets.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '2rem 0.5rem',
                      color: 'var(--text-muted)',
                      fontSize: '0.72rem'
                    }}>
                      No tickets
                    </div>
                  ) : (
                    columnTickets.map(ticket => (
                      <TicketCard
                        key={ticket.id}
                        ticket={ticket}
                        onAssign={handleAssignOpen}
                        onDispatch={handleDispatch}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ======= LIST VIEW ======= */
        <div className="quote-card" style={{ padding: 0, marginTop: '0.5rem' }}>
          <div className="quote-table-wrap">
            <table className="quote-table">
              <thead>
                <tr>
                  <th>Ticket #</th>
                  <th>Title</th>
                  <th>Client</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>SLA Response</th>
                  <th>SLA Resolution</th>
                  <th>Technician</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No tickets match filters.
                    </td>
                  </tr>
                ) : (
                  tickets.map(ticket => {
                    const statusColors = TICKET_STATUS_COLORS[ticket.status as ServiceTicketStatus] || TICKET_STATUS_COLORS.NEW;
                    const priorityColors = TICKET_PRIORITY_COLORS[ticket.priority as TicketPriority] || TICKET_PRIORITY_COLORS.MEDIUM;
                    return (
                      <tr key={ticket.id}>
                        <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--secondary)' }}>
                          <Link href={`/service-desk/${ticket.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                            {ticket.ticket_number}
                          </Link>
                        </td>
                        <td style={{ fontWeight: 600, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ticket.title}
                        </td>
                        <td>{ticket.client_name || '—'}</td>
                        <td>
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: priorityColors.bg,
                            color: priorityColors.text,
                            border: `1px solid ${priorityColors.border}`
                          }}>
                            {ticket.priority}
                          </span>
                        </td>
                        <td>
                          <span className="q-badge" style={{
                            background: statusColors.bg,
                            color: statusColors.text,
                            borderColor: statusColors.border
                          }}>
                            {TICKET_STATUS_LABELS[ticket.status as ServiceTicketStatus] || ticket.status}
                          </span>
                        </td>
                        <td>
                          <SLAClock dueDate={ticket.sla_response_due} label="RSP" met={ticket.response_met ?? null} />
                        </td>
                        <td>
                          <SLAClock dueDate={ticket.sla_resolution_due} label="RES" met={ticket.resolution_met ?? null} />
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>{ticket.technician_name || '—'}</td>
                        <td style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
                          {new Date(ticket.created_at).toLocaleDateString('en-GB')}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <Link
                            href={`/service-desk/${ticket.id}`}
                            className="quote-btn quote-btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem', textDecoration: 'none' }}
                          >
                            <Eye size={12} /> View
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======= ASSIGNMENT MODAL ======= */}
      {assignModal.open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--card-bg, var(--bg-card))',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '420px',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={18} style={{ color: 'var(--primary)' }} /> Assign Technician
            </h3>

            <select
              value={selectedTech}
              onChange={(e) => setSelectedTech(e.target.value)}
              className="quote-filter-input"
              style={{ width: '100%', fontSize: '0.9rem', padding: '0.75rem', marginBottom: '1rem' }}
            >
              <option value="">Select Technician...</option>
              {techs.map(t => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setAssignModal({ open: false, ticketId: '' })}
                className="quote-btn quote-btn-secondary"
                style={{ flex: 1, padding: '0.7rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAssignConfirm}
                disabled={!selectedTech || actionLoading}
                className="quote-btn quote-btn-primary"
                style={{ flex: 1, padding: '0.7rem', opacity: !selectedTech || actionLoading ? 0.5 : 1 }}
              >
                {actionLoading ? 'Assigning...' : 'Assign & Notify'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
