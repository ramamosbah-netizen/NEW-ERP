// ============================================================
// JEET ERP — Technician Home Page ("My Day" Unified Dashboard)
// Route: /technician
// Mobile-first: shows today's PPM visits + assigned tickets
// ============================================================

'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Wrench,
  AlertTriangle,
  CheckCircle,
  Play,
  ChevronRight,
  RefreshCw,
  Timer,
  Shield,
  Headphones,
  Zap,
  ClipboardCheck,
  Sun,
  Moon,
  Sunrise
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { visitService } from '@/services/visitService';
import { ticketService } from '@/services/ticketService';
import {
  PPM_VISIT_STATUS_LABELS,
  PPM_VISIT_STATUS_COLORS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
  TICKET_PRIORITY_COLORS
} from '@/constants/amc.constants';
import type { PPMVisit } from '@/types/ppm.types';
import type { ServiceTicket, ServiceTicketStatus, TicketPriority } from '@/types/ticket.types';

function TimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good Morning', icon: Sunrise, period: 'AM' };
  if (hour < 17) return { text: 'Good Afternoon', icon: Sun, period: 'PM' };
  return { text: 'Good Evening', icon: Moon, period: 'PM' };
}

function SLAMini({ dueDate, met }: { dueDate: string; met?: boolean | null }) {
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const isOverdue = diffMs < 0;
  const abs = Math.abs(diffMs);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);

  let color = 'var(--accent)';
  if (met === true) color = 'var(--accent)';
  else if (met === false || isOverdue) color = '#ef4444';
  else if (h < 1) color = '#ef4444';
  else if (h < 4) color = '#f97316';

  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.7rem', color }}>
      {met !== null && met !== undefined
        ? (met ? '✓' : '✗')
        : `${isOverdue ? '-' : ''}${h}h${m}m`
      }
    </span>
  );
}

export default function TechnicianHomePage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [visits, setVisits] = useState<PPMVisit[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'visits' | 'tickets'>('overview');

  const greeting = TimeGreeting();
  const GreetIcon = greeting.icon;
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single();

      setCurrentUser({ ...user, ...profile });

      // My PPM visits: scheduled or in-progress
      const todayStr = new Date().toISOString().split('T')[0];
      const myVisits = await visitService.fetchPPMVisits({ technicianId: user.id });
      setVisits(myVisits);

      // My tickets: assigned to me, active statuses
      const myTickets = await ticketService.fetchTickets({ technicianId: user.id });
      setTickets(myTickets.filter(t => ['ASSIGNED', 'IN_PROGRESS', 'ON_HOLD_PARTS'].includes(t.status)));
    } catch (err) {
      console.error('Failed to load technician dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Derived metrics
  const todayVisits = visits.filter(v =>
    v.scheduled_date === new Date().toISOString().split('T')[0] &&
    ['SCHEDULED', 'IN_PROGRESS'].includes(v.status)
  );
  const upcomingVisits = visits.filter(v =>
    v.scheduled_date && v.scheduled_date > new Date().toISOString().split('T')[0] &&
    v.status === 'SCHEDULED'
  ).slice(0, 5);
  const overdueVisits = visits.filter(v => v.status === 'MISSED');
  const completedToday = visits.filter(v =>
    v.status === 'COMPLETED' && v.completed_at &&
    v.completed_at.split('T')[0] === new Date().toISOString().split('T')[0]
  );
  const urgentTickets = tickets.filter(t => t.priority === 'EMERGENCY' || t.priority === 'HIGH');
  const slaBreach = tickets.filter(t => new Date(t.sla_resolution_due) < new Date());

  return (
    <div className="quote-container" style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Greeting Header */}
      <header style={{
        padding: '1.5rem 0',
        borderBottom: '1px solid var(--surface-hover)',
        marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <GreetIcon size={28} style={{ color: 'var(--warning)' }} />
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>
              {greeting.text}, {currentUser?.full_name || 'Technician'}
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{today}</p>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
          <div style={{
            padding: '0.8rem',
            background: 'rgba(14, 165, 233, 0.08)',
            border: '1px solid rgba(14, 165, 233, 0.15)',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0ea5e9', fontFamily: 'var(--font-mono)' }}>
              {todayVisits.length}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Today's Visits
            </div>
          </div>

          <div style={{
            padding: '0.8rem',
            background: 'rgba(249, 115, 22, 0.08)',
            border: '1px solid rgba(249, 115, 22, 0.15)',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f97316', fontFamily: 'var(--font-mono)' }}>
              {tickets.length}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Active Tickets
            </div>
          </div>

          <div style={{
            padding: '0.8rem',
            background: slaBreach.length > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(0, 229, 160, 0.08)',
            border: `1px solid ${slaBreach.length > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 229, 160, 0.15)'}`,
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '1.6rem',
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              color: slaBreach.length > 0 ? '#ef4444' : 'var(--accent)'
            }}>
              {slaBreach.length}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              SLA Breach
            </div>
          </div>

          <div style={{
            padding: '0.8rem',
            background: 'rgba(0, 229, 160, 0.08)',
            border: '1px solid rgba(0, 229, 160, 0.15)',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
              {completedToday.length}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Done Today
            </div>
          </div>
        </div>
      </header>

      {/* Tab Switcher */}
      <div style={{
        display: 'flex',
        gap: '0.25rem',
        background: 'rgba(0,0,0,0.25)',
        borderRadius: '10px',
        padding: '4px',
        marginBottom: '1.5rem',
        border: '1px solid var(--surface-hover)'
      }}>
        {[
          { key: 'overview', label: 'My Day', icon: Sun },
          { key: 'visits', label: 'PPM Visits', icon: ClipboardCheck },
          { key: 'tickets', label: 'Service Tickets', icon: Headphones }
        ].map(tab => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                flex: 1,
                padding: '0.6rem',
                borderRadius: '8px',
                background: isActive ? 'rgba(0, 229, 160, 0.12)' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                border: isActive ? '1px solid rgba(0, 229, 160, 0.2)' : '1px solid transparent',
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: isActive ? 700 : 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                transition: 'all 0.2s ease'
              }}
            >
              <TabIcon size={14} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Refresh */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
        <button onClick={loadData} className="quote-btn quote-btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.72rem' }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading your schedule...</p>
        </div>
      ) : (
        <>
          {/* ======= OVERVIEW TAB ======= */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Urgent Alerts */}
              {(urgentTickets.length > 0 || overdueVisits.length > 0) && (
                <div className="quote-card" style={{
                  padding: '1rem',
                  borderLeft: '3px solid #ef4444',
                  background: 'rgba(239, 68, 68, 0.05)'
                }}>
                  <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ef4444', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={16} /> Urgent Attention Required
                  </h3>
                  {urgentTickets.map(t => (
                    <Link key={t.id} href={`/service-desk/${t.id}`} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: '6px',
                      marginBottom: '0.4rem',
                      textDecoration: 'none',
                      color: '#fff',
                      fontSize: '0.8rem'
                    }}>
                      <Zap size={14} style={{ color: '#ef4444' }} />
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--secondary)', fontWeight: 700 }}>{t.ticket_number}</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                      <SLAMini dueDate={t.sla_resolution_due} met={t.resolution_met ?? null} />
                      <ChevronRight size={14} />
                    </Link>
                  ))}
                  {overdueVisits.map(v => (
                    <div key={v.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: '6px',
                      marginBottom: '0.4rem',
                      fontSize: '0.8rem',
                      color: '#f97316'
                    }}>
                      <AlertTriangle size={14} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{v.visit_number}</span>
                      <span>MISSED — {v.client_name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Today's PPM Visits */}
              <div className="quote-card" style={{ padding: '1.2rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar size={16} style={{ color: 'var(--secondary)' }} /> Today's PPM Visits
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '6px',
                    background: 'rgba(14, 165, 233, 0.1)',
                    color: '#0ea5e9',
                    fontFamily: 'var(--font-mono)'
                  }}>
                    {todayVisits.length}
                  </span>
                </h3>

                {todayVisits.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem' }}>
                    No PPM visits scheduled for today.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {todayVisits.map(v => {
                      const colors = PPM_VISIT_STATUS_COLORS[v.status] || PPM_VISIT_STATUS_COLORS.SCHEDULED;
                      return (
                        <Link key={v.id} href={`/ppm/execute/${v.id}`} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.8rem',
                          background: 'rgba(0,0,0,0.2)',
                          border: '1px solid var(--surface-hover)',
                          borderRadius: '8px',
                          textDecoration: 'none',
                          color: '#fff',
                          transition: 'all 0.2s ease'
                        }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.8rem', color: 'var(--secondary)' }}>
                                {v.visit_number}
                              </span>
                              <span style={{
                                fontSize: '0.6rem',
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: '3px',
                                background: colors.bg,
                                color: colors.text,
                                border: `1px solid ${colors.border}`
                              }}>
                                {PPM_VISIT_STATUS_LABELS[v.status]}
                              </span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                {v.scheduled_slot === 'AM' ? '☀ AM' : '🌙 PM'}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{v.client_name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <MapPin size={10} /> {v.site_name}
                            </div>
                          </div>
                          <div style={{
                            padding: '0.5rem',
                            borderRadius: '8px',
                            background: v.status === 'IN_PROGRESS' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(0, 229, 160, 0.15)',
                            color: v.status === 'IN_PROGRESS' ? '#eab308' : 'var(--primary)'
                          }}>
                            {v.status === 'IN_PROGRESS' ? <Play size={18} /> : <ChevronRight size={18} />}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Active Service Tickets */}
              <div className="quote-card" style={{ padding: '1.2rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Headphones size={16} style={{ color: 'var(--warning)' }} /> Active Tickets
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '6px',
                    background: 'rgba(249, 115, 22, 0.1)',
                    color: '#f97316',
                    fontFamily: 'var(--font-mono)'
                  }}>
                    {tickets.length}
                  </span>
                </h3>

                {tickets.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem' }}>
                    No active tickets assigned to you.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {tickets.slice(0, 8).map(t => {
                      const statusColors = TICKET_STATUS_COLORS[t.status as ServiceTicketStatus] || TICKET_STATUS_COLORS.NEW;
                      const prioColors = TICKET_PRIORITY_COLORS[t.priority as TicketPriority] || TICKET_PRIORITY_COLORS.MEDIUM;
                      return (
                        <Link key={t.id} href={`/service-desk/${t.id}`} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.8rem',
                          background: 'rgba(0,0,0,0.2)',
                          border: '1px solid var(--surface-hover)',
                          borderLeft: `3px solid ${prioColors.text}`,
                          borderRadius: '8px',
                          textDecoration: 'none',
                          color: '#fff',
                          transition: 'all 0.2s ease'
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.75rem', color: 'var(--secondary)' }}>
                                {t.ticket_number}
                              </span>
                              <span style={{
                                fontSize: '0.58rem',
                                fontWeight: 700,
                                padding: '1px 4px',
                                borderRadius: '3px',
                                background: prioColors.bg,
                                color: prioColors.text
                              }}>
                                {t.priority}
                              </span>
                              <span style={{
                                fontSize: '0.58rem',
                                fontWeight: 700,
                                padding: '1px 4px',
                                borderRadius: '3px',
                                background: statusColors.bg,
                                color: statusColors.text
                              }}>
                                {TICKET_STATUS_LABELS[t.status as ServiceTicketStatus]}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t.title}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
                              <MapPin size={10} /> {t.site_address?.substring(0, 40)}...
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem', flexShrink: 0 }}>
                            <SLAMini dueDate={t.sla_resolution_due} met={t.resolution_met ?? null} />
                            <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Upcoming */}
              {upcomingVisits.length > 0 && (
                <div className="quote-card" style={{ padding: '1.2rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={16} style={{ color: 'var(--text-muted)' }} /> Upcoming PPM Visits
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {upcomingVisits.map(v => (
                      <div key={v.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.6rem',
                        background: 'rgba(0,0,0,0.15)',
                        borderRadius: '6px',
                        fontSize: '0.8rem'
                      }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: '80px' }}>
                          {v.scheduled_date ? new Date(v.scheduled_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--secondary)', fontSize: '0.75rem' }}>
                          {v.visit_number}
                        </span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                          {v.client_name} — {v.site_name}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {v.scheduled_slot}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======= VISITS TAB ======= */}
          {activeTab === 'visits' && (
            <div className="quote-card" style={{ padding: '1.2rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>All My PPM Visits</h3>
              {visits.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No visits assigned.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {visits.map(v => {
                    const colors = PPM_VISIT_STATUS_COLORS[v.status] || PPM_VISIT_STATUS_COLORS.SCHEDULED;
                    return (
                      <Link key={v.id} href={v.status === 'COMPLETED' ? `/amc/${v.contract_id}` : `/ppm/execute/${v.id}`} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem',
                        background: 'rgba(0,0,0,0.15)',
                        border: '1px solid var(--surface-hover)',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        color: '#fff'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.78rem', color: 'var(--secondary)' }}>
                            {v.visit_number}
                          </span>
                          <span style={{
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: colors.bg,
                            color: colors.text
                          }}>
                            {PPM_VISIT_STATUS_LABELS[v.status]}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{v.client_name}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {v.scheduled_date ? new Date(v.scheduled_date).toLocaleDateString('en-GB') : 'Unscheduled'}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ======= TICKETS TAB ======= */}
          {activeTab === 'tickets' && (
            <div className="quote-card" style={{ padding: '1.2rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>My Assigned Tickets</h3>
              {tickets.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No tickets assigned.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {tickets.map(t => {
                    const statusColors = TICKET_STATUS_COLORS[t.status as ServiceTicketStatus] || TICKET_STATUS_COLORS.NEW;
                    const prioColors = TICKET_PRIORITY_COLORS[t.priority as TicketPriority] || TICKET_PRIORITY_COLORS.MEDIUM;
                    return (
                      <Link key={t.id} href={`/service-desk/${t.id}`} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem',
                        background: 'rgba(0,0,0,0.15)',
                        border: '1px solid var(--surface-hover)',
                        borderLeft: `3px solid ${prioColors.text}`,
                        borderRadius: '6px',
                        textDecoration: 'none',
                        color: '#fff'
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.75rem', color: 'var(--secondary)' }}>
                              {t.ticket_number}
                            </span>
                            <span style={{
                              fontSize: '0.58rem', fontWeight: 700, padding: '1px 4px', borderRadius: '3px',
                              background: prioColors.bg, color: prioColors.text
                            }}>
                              {t.priority}
                            </span>
                            <span style={{
                              fontSize: '0.58rem', fontWeight: 700, padding: '1px 4px', borderRadius: '3px',
                              background: statusColors.bg, color: statusColors.text
                            }}>
                              {TICKET_STATUS_LABELS[t.status as ServiceTicketStatus]}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.title}
                          </div>
                        </div>
                        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.15rem' }}>
                          <SLAMini dueDate={t.sla_resolution_due} met={t.resolution_met ?? null} />
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {new Date(t.created_at).toLocaleDateString('en-GB')}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
