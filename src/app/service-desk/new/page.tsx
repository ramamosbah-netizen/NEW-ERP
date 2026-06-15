// ============================================================
// JEET ERP — New Service Ticket Log Form
// Route: /service-desk/new
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Headphones,
  Phone,
  Mail,
  MessageCircle,
  AlertTriangle,
  Send,
  Loader2,
  MapPin,
  User,
  Shield,
  Wrench
} from 'lucide-react';
import { useTicket } from '@/hooks/useTickets';
import { supabase } from '@/lib/supabase';
import {
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_COLORS,
  TICKET_COVERAGE_LABELS,
  TICKET_INTAKE_LABELS
} from '@/constants/amc.constants';
import type { TicketPriority, TicketIntakeChannel, TicketCoverage } from '@/types/ticket.types';

const SYSTEM_OPTIONS = ['CCTV', 'ACCESS_CONTROL', 'GATE_BARRIER', 'INTERCOM', 'FIRE_ALARM', 'NETWORKING', 'OTHER'];

const INTAKE_ICONS: Record<string, any> = {
  MANUAL: Headphones,
  PHONE: Phone,
  EMAIL: Mail,
  WHATSAPP: MessageCircle
};

export default function NewTicketPage() {
  const router = useRouter();
  const { createTicket, loading } = useTicket();

  const [clients, setClients] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    intake_channel: 'MANUAL' as TicketIntakeChannel,
    client_id: '',
    contract_id: '',
    site_address: '',
    system: 'CCTV',
    title: '',
    description: '',
    reported_by_name: '',
    reported_by_phone: '',
    priority: 'MEDIUM' as TicketPriority,
    coverage: 'COVERED' as TicketCoverage
  });

  // Load clients
  useEffect(() => {
    supabase
      .from('clients')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        if (data) setClients(data);
      });
  }, []);

  // Load contracts when client changes
  useEffect(() => {
    if (form.client_id) {
      supabase
        .from('amc_contracts')
        .select('id, contract_number, site_address, site_name, sla_tier')
        .eq('client_id', form.client_id)
        .in('status', ['ACTIVE', 'EXPIRING'])
        .then(({ data }) => {
          if (data) setContracts(data);
        });
    } else {
      setContracts([]);
    }
  }, [form.client_id]);

  // Auto-fill site address from contract
  useEffect(() => {
    if (form.contract_id) {
      const contract = contracts.find(c => c.id === form.contract_id);
      if (contract) {
        setForm(prev => ({
          ...prev,
          site_address: contract.site_address || prev.site_address,
          coverage: 'COVERED'
        }));
      }
    }
  }, [form.contract_id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.description.trim() || !form.reported_by_name.trim() || !form.site_address.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const ticket = await createTicket({
        intake_channel: form.intake_channel,
        client_id: form.client_id || undefined,
        contract_id: form.contract_id || undefined,
        site_address: form.site_address,
        system: form.system,
        title: form.title,
        description: form.description,
        reported_by_name: form.reported_by_name,
        reported_by_phone: form.reported_by_phone,
        priority: form.priority,
        coverage: form.coverage
      });
      router.push(`/service-desk/${ticket.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="quote-container" style={{ maxWidth: '800px' }}>
      {/* Header */}
      <header className="quote-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/service-desk" style={{ color: 'var(--text-secondary)' }}>
            <ArrowLeft size={22} />
          </Link>
          <div>
            <h1 className="quote-header-title">Log New Service Ticket</h1>
            <p className="quote-header-subtitle">JEET ERP Service Desk — Reactive Call-Out Registration</p>
          </div>
        </div>
      </header>

      {/* Error */}
      {error && (
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
          {error}
        </div>
      )}

      {/* Intake Channel Selector */}
      <div className="quote-card" style={{ padding: '1.2rem' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>Intake Channel</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
          {(Object.keys(TICKET_INTAKE_LABELS) as TicketIntakeChannel[]).map(channel => {
            const Icon = INTAKE_ICONS[channel] || Headphones;
            const isSelected = form.intake_channel === channel;
            return (
              <button
                key={channel}
                onClick={() => setForm(prev => ({ ...prev, intake_channel: channel }))}
                style={{
                  padding: '0.75rem 0.5rem',
                  borderRadius: '8px',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--surface-hover)',
                  background: isSelected ? 'rgba(0, 229, 160, 0.1)' : 'rgba(0,0,0,0.2)',
                  color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  transition: 'all 0.2s ease'
                }}
              >
                <Icon size={18} />
                {channel.replace('_', ' ')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Form */}
      <div className="quote-card" style={{ padding: '1.5rem' }}>
        <div className="quote-form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {/* Client */}
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
              Client
            </label>
            <select
              name="client_id"
              value={form.client_id}
              onChange={handleChange}
              className="quote-filter-input"
              style={{ width: '100%', padding: '0.65rem' }}
            >
              <option value="">Select client (optional)...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Contract */}
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
              AMC Contract
            </label>
            <select
              name="contract_id"
              value={form.contract_id}
              onChange={handleChange}
              className="quote-filter-input"
              style={{ width: '100%', padding: '0.65rem' }}
              disabled={!form.client_id}
            >
              <option value="">No contract (chargeable)</option>
              {contracts.map(c => (
                <option key={c.id} value={c.id}>{c.contract_number} — {c.site_name}</option>
              ))}
            </select>
          </div>

          {/* Title - full width */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
              Issue Title *
            </label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              className="quote-filter-input"
              placeholder="Brief description of the issue (e.g., Camera 3 offline)"
              style={{ width: '100%', padding: '0.65rem' }}
            />
          </div>

          {/* Description - full width */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
              Detailed Description *
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              className="quote-filter-input"
              placeholder="Full details of the reported issue..."
              rows={4}
              style={{ width: '100%', padding: '0.65rem', resize: 'vertical' }}
            />
          </div>

          {/* Site Address */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
              Site Address *
            </label>
            <input
              type="text"
              name="site_address"
              value={form.site_address}
              onChange={handleChange}
              className="quote-filter-input"
              placeholder="Full address of the site"
              style={{ width: '100%', padding: '0.65rem' }}
            />
          </div>

          {/* System */}
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
              System
            </label>
            <select
              name="system"
              value={form.system}
              onChange={handleChange}
              className="quote-filter-input"
              style={{ width: '100%', padding: '0.65rem' }}
            >
              {SYSTEM_OPTIONS.map(s => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
              Priority
            </label>
            <select
              name="priority"
              value={form.priority}
              onChange={handleChange}
              className="quote-filter-input"
              style={{ width: '100%', padding: '0.65rem' }}
            >
              {Object.entries(TICKET_PRIORITY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Coverage */}
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
              Coverage
            </label>
            <select
              name="coverage"
              value={form.coverage}
              onChange={handleChange}
              className="quote-filter-input"
              style={{ width: '100%', padding: '0.65rem' }}
            >
              {Object.entries(TICKET_COVERAGE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Reporter Name */}
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
              Reported By (Name) *
            </label>
            <input
              type="text"
              name="reported_by_name"
              value={form.reported_by_name}
              onChange={handleChange}
              className="quote-filter-input"
              placeholder="Person who reported the issue"
              style={{ width: '100%', padding: '0.65rem' }}
            />
          </div>

          {/* Reporter Phone */}
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
              Reporter Phone
            </label>
            <input
              type="tel"
              name="reported_by_phone"
              value={form.reported_by_phone}
              onChange={handleChange}
              className="quote-filter-input"
              placeholder="+971 5X XXX XXXX"
              style={{ width: '100%', padding: '0.65rem' }}
            />
          </div>
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--surface-hover)', paddingTop: '1rem' }}>
          <Link
            href="/service-desk"
            className="quote-btn quote-btn-secondary"
            style={{ padding: '0.7rem 1.5rem', textDecoration: 'none' }}
          >
            Cancel
          </Link>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="quote-btn quote-btn-primary"
            style={{ padding: '0.7rem 1.5rem', opacity: submitting ? 0.5 : 1 }}
          >
            {submitting ? (
              <><Loader2 size={14} className="spin" /> Creating...</>
            ) : (
              <><Send size={14} /> Log Ticket</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
