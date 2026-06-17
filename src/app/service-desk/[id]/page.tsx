// ============================================================
// JEET ERP — Service Ticket Detail Page
// Route: /service-desk/[id]
// Full ticket lifecycle management with SLA clocks and event timeline
// ============================================================

'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock,
  User,
  MapPin,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Send,
  Pause,
  Play,
  MessageCircle,
  Loader2,
  Timer,
  Shield,
  Wrench,
  FileText,
  Phone,
  DollarSign,
  Package,
  Plus,
  Trash2
} from 'lucide-react';
import { useTicket } from '@/hooks/useTickets';
import {
  TICKET_STATUS_LABELS,
  TICKET_STATUS_COLORS,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_COLORS,
  TICKET_COVERAGE_LABELS,
  TICKET_INTAKE_LABELS
} from '@/constants/amc.constants';
import type { ServiceTicketStatus, TicketPriority, TicketPartItem } from '@/types/ticket.types';
import WorkflowPanel from '@/components/workflow/WorkflowPanel';

function SLACountdown({ dueDate, label, met }: { dueDate: string; label: string; met?: boolean | null }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(i);
  }, []);

  const due = new Date(dueDate);
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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.2rem',
      padding: '0.75rem',
      background: `${color}08`,
      border: `1px solid ${color}20`,
      borderRadius: '8px',
      flex: 1
    }}>
      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        <Timer size={14} style={{ color }} />
        <span style={{ fontSize: '1rem', fontWeight: 800, color, fontFamily: 'var(--font-mono)' }}>
          {met !== null && met !== undefined
            ? (met ? '✓ MET' : '✗ BREACHED')
            : `${isOverdue ? '-' : ''}${h}h ${m}m`
          }
        </span>
      </div>
      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        Due: {due.toLocaleDateString('en-GB')} {due.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params?.id as string;

  const {
    ticket,
    loading,
    error,
    refetch,
    dispatchTicket,
    pauseTicketForParts,
    resumeTicket,
    resolveTicket,
    closeTicket,
    addComment
  } = useTicket(ticketId);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [commentText, setCommentText] = useState('');

  // Resolve form state
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [clientSignName, setClientSignName] = useState('');
  const [partsUsed, setPartsUsed] = useState<TicketPartItem[]>([]);
  const [pauseReason, setPauseReason] = useState('');
  const [showPauseForm, setShowPauseForm] = useState(false);

  const handleAction = async (action: () => Promise<any>, successMsg?: string) => {
    try {
      setActionLoading(true);
      setActionError('');
      await action();
      if (successMsg) logger.debug(successMsg);
    } catch (err: any) {
      setActionError(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    await handleAction(async () => {
      await addComment(commentText);
      setCommentText('');
    });
  };

  const handleResolve = async () => {
    if (!resolutionSummary.trim()) return;
    await handleAction(async () => {
      await resolveTicket(resolutionSummary, partsUsed, clientSignName || undefined);
      setShowResolveForm(false);
    });
  };

  const handlePause = async () => {
    if (!pauseReason.trim()) return;
    await handleAction(async () => {
      await pauseTicketForParts(pauseReason);
      setShowPauseForm(false);
      setPauseReason('');
    });
  };

  const addPartRow = () => {
    setPartsUsed(prev => [...prev, { item_code: '', description: '', quantity: 1, unit_price: 0, chargeable: false }]);
  };

  const updatePart = (idx: number, field: string, value: any) => {
    setPartsUsed(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const removePart = (idx: number) => {
    setPartsUsed(prev => prev.filter((_, i) => i !== idx));
  };

  if (loading && !ticket) {
    return (
      <div className="quote-container" style={{ textAlign: 'center', padding: '6rem' }}>
        <div className="spinner" style={{ margin: '0 auto 1.5rem auto' }}></div>
        <p style={{ color: 'var(--text-secondary)' }}>Loading ticket details...</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="quote-container" style={{ textAlign: 'center', padding: '4rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Ticket not found.</p>
        <Link href="/service-desk" className="quote-btn quote-btn-secondary" style={{ marginTop: '1rem', textDecoration: 'none' }}>
          <ArrowLeft size={14} /> Back to Desk
        </Link>
      </div>
    );
  }

  const statusColors = TICKET_STATUS_COLORS[ticket.status as ServiceTicketStatus] || TICKET_STATUS_COLORS.NEW;
  const priorityColors = TICKET_PRIORITY_COLORS[ticket.priority as TicketPriority] || TICKET_PRIORITY_COLORS.MEDIUM;
  const isActive = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD_PARTS'].includes(ticket.status);

  return (
    <div className="quote-container" style={{ maxWidth: '1100px' }}>
      {/* Header */}
      <header className="quote-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/service-desk" style={{ color: 'var(--text-secondary)' }}>
            <ArrowLeft size={22} />
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h1 style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--secondary)' }}>
                {ticket.ticket_number}
              </h1>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '4px',
                background: statusColors.bg,
                color: statusColors.text,
                border: `1px solid ${statusColors.border}`
              }}>
                {TICKET_STATUS_LABELS[ticket.status as ServiceTicketStatus]}
              </span>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '4px',
                background: priorityColors.bg,
                color: priorityColors.text,
                border: `1px solid ${priorityColors.border}`
              }}>
                {TICKET_PRIORITY_LABELS[ticket.priority as TicketPriority]}
              </span>
            </div>
            <p className="quote-header-subtitle" style={{ marginTop: '0.2rem' }}>{ticket.title}</p>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {actionError && (
        <div style={{
          padding: '0.75rem 1rem',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          color: 'var(--error)',
          fontSize: '0.82rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <AlertTriangle size={16} />
          {actionError}
        </div>
      )}

      {/* Configurable workflow (Admin Center → Workflows) */}
      <WorkflowPanel
        moduleKey="SERVICE_REQ"
        entityId={ticketId}
        context={{ status: ticket.status, priority: ticket.priority }}
        onStatusChange={() => refetch()}
        className="mb-6"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>
        {/* LEFT: Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* SLA Clocks */}
          {isActive && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <SLACountdown dueDate={ticket.sla_response_due} label="Response SLA" met={ticket.response_met ?? null} />
              <SLACountdown dueDate={ticket.sla_resolution_due} label="Resolution SLA" met={ticket.resolution_met ?? null} />
            </div>
          )}

          {/* Description */}
          <div className="quote-card" style={{ padding: '1.2rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={16} style={{ color: 'var(--secondary)' }} /> Description
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {ticket.description}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="quote-card" style={{ padding: '1rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Wrench size={16} style={{ color: 'var(--primary)' }} /> Actions
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {ticket.status === 'ASSIGNED' && (
                <button
                  onClick={() => handleAction(() => dispatchTicket())}
                  disabled={actionLoading}
                  className="quote-btn quote-btn-primary"
                  style={{ padding: '0.6rem 1rem', fontSize: '0.8rem' }}
                >
                  {actionLoading ? <Loader2 size={14} className="spin" /> : <Play size={14} />} Dispatch to Site
                </button>
              )}
              {ticket.status === 'IN_PROGRESS' && (
                <>
                  <button
                    onClick={() => setShowResolveForm(true)}
                    className="quote-btn quote-btn-primary"
                    style={{ padding: '0.6rem 1rem', fontSize: '0.8rem' }}
                  >
                    <CheckCircle size={14} /> Resolve Ticket
                  </button>
                  <button
                    onClick={() => setShowPauseForm(true)}
                    className="quote-btn quote-btn-secondary"
                    style={{ padding: '0.6rem 1rem', fontSize: '0.8rem' }}
                  >
                    <Pause size={14} /> Pause (Waiting Parts)
                  </button>
                </>
              )}
              {ticket.status === 'ON_HOLD_PARTS' && (
                <button
                  onClick={() => handleAction(() => resumeTicket())}
                  disabled={actionLoading}
                  className="quote-btn quote-btn-primary"
                  style={{ padding: '0.6rem 1rem', fontSize: '0.8rem' }}
                >
                  <Play size={14} /> Resume SLA Clock
                </button>
              )}
              {ticket.status === 'RESOLVED' && (
                <button
                  onClick={() => handleAction(() => closeTicket())}
                  disabled={actionLoading}
                  className="quote-btn quote-btn-primary"
                  style={{ padding: '0.6rem 1rem', fontSize: '0.8rem' }}
                >
                  <CheckCircle size={14} /> Close Ticket
                </button>
              )}
            </div>
          </div>

          {/* Pause Form */}
          {showPauseForm && (
            <div className="quote-card" style={{ padding: '1.2rem', border: '1px solid rgba(249, 115, 22, 0.3)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: '#f97316' }}>
                <Pause size={16} /> Pause SLA — Waiting for Parts
              </h3>
              <textarea
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                className="quote-filter-input"
                placeholder="Describe what parts are needed..."
                rows={3}
                style={{ width: '100%', marginBottom: '0.75rem', fontSize: '0.85rem', padding: '0.75rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setShowPauseForm(false)} className="quote-btn quote-btn-secondary" style={{ padding: '0.6rem 1rem' }}>Cancel</button>
                <button onClick={handlePause} disabled={!pauseReason.trim() || actionLoading} className="quote-btn quote-btn-primary" style={{ padding: '0.6rem 1rem', opacity: !pauseReason.trim() ? 0.5 : 1 }}>
                  {actionLoading ? 'Pausing...' : 'Pause SLA Clock'}
                </button>
              </div>
            </div>
          )}

          {/* Resolve Form */}
          {showResolveForm && (
            <div className="quote-card" style={{ padding: '1.2rem', border: '1px solid rgba(0, 229, 160, 0.3)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--primary)' }}>
                <CheckCircle size={16} /> Resolve Ticket
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
                    Resolution Summary *
                  </label>
                  <textarea
                    value={resolutionSummary}
                    onChange={(e) => setResolutionSummary(e.target.value)}
                    className="quote-filter-input"
                    placeholder="Describe how the issue was resolved..."
                    rows={4}
                    style={{ width: '100%', fontSize: '0.85rem', padding: '0.75rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
                    Client Representative Name
                  </label>
                  <input
                    type="text"
                    value={clientSignName}
                    onChange={(e) => setClientSignName(e.target.value)}
                    className="quote-filter-input"
                    placeholder="Name of the person who accepted fix"
                    style={{ width: '100%', fontSize: '0.85rem', padding: '0.75rem' }}
                  />
                </div>

                {/* Parts Used */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Parts Used
                    </label>
                    <button onClick={addPartRow} style={{
                      background: 'none',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      color: 'var(--secondary)',
                      fontSize: '0.68rem',
                      padding: '0.2rem 0.5rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem'
                    }}>
                      <Plus size={10} /> Add Part
                    </button>
                  </div>

                  {partsUsed.map((part, idx) => (
                    <div key={idx} style={{
                      display: 'grid',
                      gridTemplateColumns: '80px 1fr 60px 80px 60px 30px',
                      gap: '0.4rem',
                      marginBottom: '0.4rem',
                      alignItems: 'center'
                    }}>
                      <input
                        type="text"
                        value={part.item_code}
                        onChange={(e) => updatePart(idx, 'item_code', e.target.value)}
                        className="quote-filter-input"
                        placeholder="Code"
                        style={{ padding: '0.35rem', fontSize: '0.72rem' }}
                      />
                      <input
                        type="text"
                        value={part.description}
                        onChange={(e) => updatePart(idx, 'description', e.target.value)}
                        className="quote-filter-input"
                        placeholder="Description"
                        style={{ padding: '0.35rem', fontSize: '0.72rem' }}
                      />
                      <input
                        type="number"
                        value={part.quantity}
                        onChange={(e) => updatePart(idx, 'quantity', Number(e.target.value))}
                        className="quote-filter-input"
                        placeholder="Qty"
                        style={{ padding: '0.35rem', fontSize: '0.72rem' }}
                      />
                      <input
                        type="number"
                        value={part.unit_price}
                        onChange={(e) => updatePart(idx, 'unit_price', Number(e.target.value))}
                        className="quote-filter-input"
                        placeholder="Price"
                        style={{ padding: '0.35rem', fontSize: '0.72rem' }}
                      />
                      <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <input
                          type="checkbox"
                          checked={part.chargeable}
                          onChange={(e) => updatePart(idx, 'chargeable', e.target.checked)}
                        />
                        Bill
                      </label>
                      <button onClick={() => removePart(idx)} style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--error)',
                        cursor: 'pointer',
                        padding: '0.2rem'
                      }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setShowResolveForm(false)} className="quote-btn quote-btn-secondary" style={{ padding: '0.6rem 1rem' }}>Cancel</button>
                  <button
                    onClick={handleResolve}
                    disabled={!resolutionSummary.trim() || actionLoading}
                    className="quote-btn quote-btn-primary"
                    style={{ padding: '0.6rem 1rem', opacity: !resolutionSummary.trim() ? 0.5 : 1 }}
                  >
                    {actionLoading ? 'Resolving...' : 'Resolve & Notify Client'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Event Timeline */}
          <div className="quote-card" style={{ padding: '1.2rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={16} style={{ color: 'var(--secondary)' }} /> Activity Timeline
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {(ticket.events || []).map((ev, idx) => (
                <div key={ev.id} style={{
                  display: 'flex',
                  gap: '0.75rem',
                  paddingBottom: '1rem',
                  borderLeft: idx < (ticket.events?.length || 0) - 1 ? '2px solid var(--surface-hover)' : 'none',
                  marginLeft: '7px',
                  paddingLeft: '1rem',
                  position: 'relative'
                }}>
                  {/* Timeline dot */}
                  <div style={{
                    position: 'absolute',
                    left: '-5px',
                    top: '2px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: ev.type === 'COMMENT'
                      ? 'var(--secondary)'
                      : ev.type === 'SLA_WARNING'
                        ? '#f97316'
                        : 'var(--primary)',
                    border: '2px solid rgba(0,0,0,0.5)'
                  }} />

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fff' }}>
                        {ev.user_full_name || 'System'}
                        {ev.user_role && (
                          <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.3rem' }}>({ev.user_role})</span>
                        )}
                      </span>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(ev.created_at).toLocaleDateString('en-GB')} {new Date(ev.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {ev.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Add comment */}
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              marginTop: '0.5rem',
              borderTop: '1px solid var(--surface-hover)',
              paddingTop: '0.75rem'
            }}>
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="quote-filter-input"
                placeholder="Add a comment or internal note..."
                style={{ flex: 1, fontSize: '0.82rem', padding: '0.6rem' }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(); }}
              />
              <button
                onClick={handleAddComment}
                disabled={!commentText.trim() || actionLoading}
                className="quote-btn quote-btn-primary"
                style={{ padding: '0.6rem 0.8rem', opacity: !commentText.trim() ? 0.5 : 1 }}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Ticket Info */}
          <div className="quote-card" style={{ padding: '1.2rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>Ticket Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Intake</span>
                <span style={{ fontWeight: 600 }}>{TICKET_INTAKE_LABELS[ticket.intake_channel] || ticket.intake_channel}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Coverage</span>
                <span style={{ fontWeight: 600 }}>{TICKET_COVERAGE_LABELS[ticket.coverage] || ticket.coverage}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>System</span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{ticket.system}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Contract</span>
                <span style={{ fontWeight: 600, color: 'var(--secondary)', fontFamily: 'var(--font-mono)' }}>
                  {ticket.contract_number || '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Created</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                  {new Date(ticket.created_at).toLocaleDateString('en-GB')}
                </span>
              </div>
            </div>
          </div>

          {/* Reporter */}
          <div className="quote-card" style={{ padding: '1.2rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Phone size={14} style={{ color: 'var(--secondary)' }} /> Reporter
            </h3>
            <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span style={{ fontWeight: 600 }}>{ticket.reported_by_name}</span>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{ticket.reported_by_phone}</span>
            </div>
          </div>

          {/* Client & Site */}
          <div className="quote-card" style={{ padding: '1.2rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MapPin size={14} style={{ color: 'var(--primary)' }} /> Client & Site
            </h3>
            <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span style={{ fontWeight: 600 }}>{ticket.client_name || '—'}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{ticket.site_address}</span>
            </div>
          </div>

          {/* Technician */}
          <div className="quote-card" style={{ padding: '1.2rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={14} style={{ color: 'var(--warning)' }} /> Assigned Technician
            </h3>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              {ticket.technician_name || 'Not yet assigned'}
            </span>
          </div>

          {/* Resolution */}
          {ticket.resolution_summary && (
            <div className="quote-card" style={{ padding: '1.2rem', border: '1px solid rgba(0, 229, 160, 0.15)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                <CheckCircle size={14} /> Resolution
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {ticket.resolution_summary}
              </p>
              {ticket.sign_name && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Accepted by: <strong>{ticket.sign_name}</strong>
                </p>
              )}
            </div>
          )}

          {/* SLA Summary for closed/resolved */}
          {['RESOLVED', 'CLOSED'].includes(ticket.status) && (
            <div className="quote-card" style={{ padding: '1.2rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={14} style={{ color: 'var(--secondary)' }} /> SLA Summary
              </h3>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    color: ticket.response_met ? 'var(--accent)' : '#ef4444'
                  }}>
                    {ticket.response_met ? '✓ MET' : '✗ BREACHED'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Response</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    color: ticket.resolution_met ? 'var(--accent)' : '#ef4444'
                  }}>
                    {ticket.resolution_met ? '✓ MET' : '✗ BREACHED'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Resolution</div>
                </div>
              </div>
              {ticket.sla_pause_total_minutes > 0 && (
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
                  Total paused: {ticket.sla_pause_total_minutes} min
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
