// ============================================================
// JEET ERP — Create AMC Contract Wizard
// Route: /amc/create
// ============================================================

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAMCContract } from '@/hooks/useAMCContracts';
import { ArrowLeft, Save, HelpCircle } from 'lucide-react';
import Link from 'next/link';

function CreateAMCForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromQuote = searchParams.get('fromQuote');
  const fromProject = searchParams.get('fromProject');

  const { createContract, loading: contractLoading, error: contractErr } = useAMCContract();

  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    client_id: '',
    site_name: '',
    site_address: '',
    emirate: 'DUBAI',
    contract_type: 'NON_COMPREHENSIVE',
    systems: [] as string[],
    parts_included: false,
    parts_cap_aed: '',
    visits_per_year: 4,
    sla_tier: 'STANDARD',
    response_hours: 24,
    resolution_hours: 48,
    emergency_callouts_included: '',
    annual_value: '',
    billing_frequency: 'QUARTERLY',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    auto_renewal: false,
    sira_linked: false,
    sira_expiry_date: '',
    notes: '',
    origin_project_id: '',
    origin_quotation_id: ''
  });

  // Calculate End Date (Start Date + 1 Year - 1 Day)
  useEffect(() => {
    if (form.start_date) {
      const start = new Date(form.start_date);
      const end = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate() - 1);
      setForm((prev) => ({ ...prev, end_date: end.toISOString().split('T')[0] }));
    }
  }, [form.start_date]);

  // Adjust SLA defaults when SLA tier changes
  useEffect(() => {
    if (form.sla_tier === 'STANDARD') {
      setForm(prev => ({ ...prev, response_hours: 24, resolution_hours: 48 }));
    } else if (form.sla_tier === 'PRIORITY') {
      setForm(prev => ({ ...prev, response_hours: 4, resolution_hours: 12 }));
    } else if (form.sla_tier === 'CRITICAL') {
      setForm(prev => ({ ...prev, response_hours: 2, resolution_hours: 4 }));
    }
  }, [form.sla_tier]);

  // Load clients and conversion source on mount
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        // Load clients
        const { data: clientList } = await supabase
          .from('clients')
          .select('id, name, trn_number, billing_address')
          .eq('is_active', true);
        if (clientList) setClients(clientList);

        // Prepopulate if fromQuote
        if (fromQuote) {
          const { data: quote } = await supabase
            .from('quotations')
            .select('*, clients(*)')
            .eq('id', fromQuote)
            .single();

          if (quote) {
            setForm((prev) => ({
              ...prev,
              client_id: quote.client_id,
              site_name: quote.subject || 'Client Site',
              site_address: quote.clients?.billing_address || quote.client_address || '',
              systems: quote.systems || [],
              annual_value: String(quote.subtotal_after_discount || quote.grand_total_with_vat || ''),
              origin_quotation_id: fromQuote,
              origin_project_id: quote.project_id || ''
            }));
          }
        }

        // Prepopulate if fromProject
        if (fromProject) {
          const { data: project } = await supabase
            .from('projects')
            .select('*, clients(*)')
            .eq('id', fromProject)
            .single();

          if (project) {
            setForm((prev) => ({
              ...prev,
              client_id: project.client_id,
              site_name: project.name || 'Project Site',
              site_address: project.site_address || '',
              emirate: project.emirate || 'DUBAI',
              systems: project.systems || [],
              annual_value: String(Math.round(project.contract_value * 0.1)), // Standard 10% amc estimate
              origin_project_id: fromProject,
              sira_linked: project.sira_applicable || false
            }));
          }
        }
      } catch (err) {
        console.error('Error initializing form:', err);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [fromQuote, fromProject]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    const val = isCheckbox ? (e.target as HTMLInputElement).checked : value;

    setForm((prev) => ({
      ...prev,
      [name]: val
    }));
  };

  const handleSystemToggle = (sys: string) => {
    setForm((prev) => {
      const active = prev.systems.includes(sys)
        ? prev.systems.filter((s) => s !== sys)
        : [...prev.systems, sys];
      return { ...prev, systems: active };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id || !form.site_name || !form.annual_value) {
      alert('Please fill in all required fields (Client, Site Name, and Annual Value)');
      return;
    }

    try {
      const payload = {
        ...form,
        emirate: form.emirate as any,
        contract_type: form.contract_type as any,
        billing_frequency: form.billing_frequency as any,
        sla_tier: form.sla_tier as any,
        annual_value: Number(form.annual_value),
        parts_cap_aed: form.parts_cap_aed ? Number(form.parts_cap_aed) : undefined,
        visits_per_year: Number(form.visits_per_year),
        response_hours: Number(form.response_hours),
        resolution_hours: Number(form.resolution_hours),
        emergency_callouts_included: form.emergency_callouts_included ? Number(form.emergency_callouts_included) : undefined,
        sira_expiry_date: form.sira_expiry_date || undefined
      };

      const res = await createContract(payload as any);
      if (fromQuote) {
        // Mark quotation as ACCEPTED_BY_CLIENT / convert triggers if needed
        await supabase
          .from('quotations')
          .update({ is_locked: true, updated_at: new Date().toISOString() })
          .eq('id', fromQuote);
      }
      router.push(`/amc/${res.id}`);
    } catch (err: any) {
      console.error(err);
      alert('Error creating AMC contract: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="quote-container">
        <div className="quote-card" style={{ textAlign: 'center', padding: '4rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
          <p>Initializing contract wizard...</p>
        </div>
      </div>
    );
  }

  const systemOptions = ['CCTV', 'ACCESS_CONTROL', 'FIRE_ALARM', 'BMS', 'STRUCTURED_CABLING', 'PA_AV_BGM', 'GATE_BARRIER', 'KNX_SMART_HOME', 'ELECTRICAL', 'OTHER'];
  const emirateOptions = ['DUBAI', 'ABU_DHABI', 'SHARJAH', 'AJMAN', 'UMM_AL_QUWAIN', 'RAS_AL_KHAIMAH', 'FUJAIRAH'];

  return (
    <div className="quote-container">
      {/* Header */}
      <header className="quote-header">
        <div>
          <Link href="/amc" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', textDecoration: 'none', fontSize: '0.82rem', marginBottom: '0.5rem', fontWeight: 600 }}>
            <ArrowLeft size={14} /> Back to Registry
          </Link>
          <h1 className="quote-header-title">Initialize AMC Contract</h1>
          <p className="quote-header-subtitle">Create a new Annual Maintenance Contract draft in the registry</p>
        </div>
      </header>

      {/* Main Form */}
      <form onSubmit={handleSubmit}>
        <div className="quote-card">
          <div className="quote-card-header">
            <h2 className="quote-card-title">Client & Site Coordinates</h2>
          </div>

          <div className="quote-form-grid">
            {/* Client Select */}
            <div className="quote-form-group">
              <label>Client Partner *</label>
              <select
                name="client_id"
                className="quote-form-input"
                value={form.client_id}
                onChange={handleChange}
                required
              >
                <option value="">Select Client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Site Name */}
            <div className="quote-form-group">
              <label>Site / Project Name *</label>
              <input
                type="text"
                name="site_name"
                className="quote-form-input"
                placeholder="e.g. Dubai Marina Mall, office fitout"
                value={form.site_name}
                onChange={handleChange}
                required
              />
            </div>

            {/* Site Address */}
            <div className="quote-form-group">
              <label>Site Full Address *</label>
              <input
                type="text"
                name="site_address"
                className="quote-form-input"
                placeholder="Street/Plot coordinates"
                value={form.site_address}
                onChange={handleChange}
                required
              />
            </div>

            {/* Emirate */}
            <div className="quote-form-group">
              <label>Emirate *</label>
              <select
                name="emirate"
                className="quote-form-input"
                value={form.emirate}
                onChange={handleChange}
              >
                {emirateOptions.map((e) => (
                  <option key={e} value={e}>{e.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Contract Coverage details */}
        <div className="quote-card">
          <div className="quote-card-header">
            <h2 className="quote-card-title">Coverage & Scope Matrix</h2>
          </div>

          <div className="quote-form-grid">
            {/* Contract Type */}
            <div className="quote-form-group">
              <label>Contract Type *</label>
              <select
                name="contract_type"
                className="quote-form-input"
                value={form.contract_type}
                onChange={handleChange}
              >
                <option value="COMPREHENSIVE">Comprehensive (Includes Parts)</option>
                <option value="NON_COMPREHENSIVE">Non-Comprehensive (Labour Only + Consumables)</option>
                <option value="LABOUR_ONLY">Labour Only</option>
              </select>
            </div>

            {/* SLA Tier */}
            <div className="quote-form-group">
              <label>SLA Service Level *</label>
              <select
                name="sla_tier"
                className="quote-form-input"
                value={form.sla_tier}
                onChange={handleChange}
              >
                <option value="STANDARD">Standard (24h Response / 48h Resolution)</option>
                <option value="PRIORITY">Priority (4h Response / 12h Resolution)</option>
                <option value="CRITICAL">Critical (2h Response / 4h Resolution)</option>
              </select>
            </div>

            {/* Response Hours */}
            <div className="quote-form-group">
              <label>SLA Response Hours Override</label>
              <input
                type="number"
                name="response_hours"
                className="quote-form-input"
                value={form.response_hours}
                onChange={handleChange}
              />
            </div>

            {/* Resolution Hours */}
            <div className="quote-form-group">
              <label>SLA Resolution Hours Override</label>
              <input
                type="number"
                name="resolution_hours"
                className="quote-form-input"
                value={form.resolution_hours}
                onChange={handleChange}
              />
            </div>

            {/* Visits Per Year */}
            <div className="quote-form-group">
              <label>Scheduled PPM Visits / Year *</label>
              <input
                type="number"
                name="visits_per_year"
                className="quote-form-input"
                value={form.visits_per_year}
                onChange={handleChange}
                min={1}
                required
              />
            </div>

            {/* Emergency Callouts */}
            <div className="quote-form-group">
              <label>Emergency Callouts Included</label>
              <input
                type="number"
                name="emergency_callouts_included"
                className="quote-form-input"
                placeholder="Leave blank if unlimited"
                value={form.emergency_callouts_included}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Parts checkbox / cap */}
          <div style={{ display: 'flex', gap: '2rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                name="parts_included"
                checked={form.parts_included}
                onChange={handleChange}
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
              />
              Spare Parts Included in Contract Scope
            </label>

            {form.parts_included && (
              <div className="quote-form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label>Spare Parts Cap Value (AED)</label>
                <input
                  type="number"
                  name="parts_cap_aed"
                  className="quote-form-input"
                  placeholder="AED cap per ticket/year"
                  value={form.parts_cap_aed}
                  onChange={handleChange}
                />
              </div>
            )}
          </div>

          {/* Systems Checklist */}
          <div style={{ marginTop: '1.5rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Covered ELV/MEP Systems</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.8rem' }}>
              {systemOptions.map((sys) => {
                const isActive = form.systems.includes(sys);
                return (
                  <button
                    key={sys}
                    type="button"
                    onClick={() => handleSystemToggle(sys)}
                    style={{
                      background: isActive ? 'rgba(0, 229, 160, 0.08)' : 'rgba(0,0,0,0.2)',
                      border: `1px solid ${isActive ? 'var(--primary)' : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: '8px',
                      padding: '0.6rem',
                      color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'var(--transition-fast)'
                    }}
                  >
                    {sys.replace('_', ' ')}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Commercial & Billing Parameters */}
        <div className="quote-card">
          <div className="quote-card-header">
            <h2 className="quote-card-title">Commercial & Period Specifications</h2>
          </div>

          <div className="quote-form-grid">
            {/* Annual Value */}
            <div className="quote-form-group">
              <label>Contract Annual Value (AED) *</label>
              <input
                type="number"
                name="annual_value"
                className="quote-form-input"
                placeholder="AED amount excluding VAT"
                value={form.annual_value}
                onChange={handleChange}
                required
              />
            </div>

            {/* Billing Frequency */}
            <div className="quote-form-group">
              <label>Billing Installments Frequency *</label>
              <select
                name="billing_frequency"
                className="quote-form-input"
                value={form.billing_frequency}
                onChange={handleChange}
              >
                <option value="ANNUAL_ADVANCE">Annual Advance (100% upfront)</option>
                <option value="SEMI_ANNUAL">Semi-Annual (50% twice a year)</option>
                <option value="QUARTERLY">Quarterly (25% every 3 months)</option>
                <option value="MONTHLY">Monthly (8.33% every month)</option>
              </select>
            </div>

            {/* Start Date */}
            <div className="quote-form-group">
              <label>Contract Start Date *</label>
              <input
                type="date"
                name="start_date"
                className="quote-form-input"
                value={form.start_date}
                onChange={handleChange}
                required
              />
            </div>

            {/* End Date */}
            <div className="quote-form-group">
              <label>Contract Expiration Date *</label>
              <input
                type="date"
                name="end_date"
                className="quote-form-input"
                value={form.end_date}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* SIRA & Auto renewal checkboxes */}
          <div style={{ display: 'flex', gap: '2rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                name="auto_renewal"
                checked={form.auto_renewal}
                onChange={handleChange}
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
              />
              Auto-Renewal Eligible
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                name="sira_linked"
                checked={form.sira_linked}
                onChange={handleChange}
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
              />
              SIRA Linked (Security Regulatory Compliance)
            </label>

            {form.sira_linked && (
              <div className="quote-form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label>SIRA Maintenance Certificate Expiry</label>
                <input
                  type="date"
                  name="sira_expiry_date"
                  className="quote-form-input"
                  value={form.sira_expiry_date}
                  onChange={handleChange}
                />
              </div>
            )}
          </div>
        </div>

        {/* Notes & Actions */}
        <div className="quote-card">
          <div className="quote-form-group">
            <label>Additional Notes / Scope Inclusions</label>
            <textarea
              name="notes"
              className="quote-form-textarea"
              placeholder="Scope descriptions, specific exclusions..."
              value={form.notes}
              onChange={handleChange}
            />
          </div>

          {contractErr && (
            <p style={{ color: 'var(--error)', marginTop: '1rem', fontSize: '0.85rem' }}>Error: {contractErr.message}</p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
            <Link href="/amc" className="quote-btn quote-btn-secondary" style={{ textDecoration: 'none' }}>
              Cancel
            </Link>
            <button
              type="submit"
              className="quote-btn quote-btn-primary"
              disabled={contractLoading}
            >
              <Save size={16} /> Save Contract Draft
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function CreateAMCPage() {
  return (
    <Suspense fallback={<div className="quote-container"><div className="quote-card"><p>Loading Wizard...</p></div></div>}>
      <CreateAMCForm />
    </Suspense>
  );
}
