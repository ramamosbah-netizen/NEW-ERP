// ============================================================
// JEET ERP — Project Manual Wizard Component
// Multi-step form wizard for manual project registration: Basics → Commercial → Milestones → Review
// ============================================================

import { logger } from '@/lib/logger';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { projectService } from '@/lib/project-service';
import { useCompany } from '@/lib/company/useCompany';
import type { ProjectStatus, ProjectType, Emirate, ProjectSystem } from '@/types/project.types';
import { Plus, Trash2, Calendar, DollarSign, Briefcase } from 'lucide-react';

type Props = {
  quotationId?: string; // Pre-fill if created from quote
};

export const ProjectWizard: React.FC<Props> = ({ quotationId }) => {
  const router = useRouter();
  const { activeCompanyId } = useCompany();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lists from DB
  const [clients, setClients] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [engineers, setEngineers] = useState<any[]>([]);

  // 1. Basics State
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('SUPPLY_INSTALL');
  const [systems, setSystems] = useState<ProjectSystem[]>([]);
  const [pmId, setPmId] = useState('');
  const [engineerId, setEngineerId] = useState('');
  const [emirate, setEmirate] = useState<Emirate>('DUBAI');
  const [siteAddress, setSiteAddress] = useState('');
  const [makaniOrPlot, setMakaniOrPlot] = useState('');

  // 2. Commercial State
  const [contractValue, setContractValue] = useState(0);
  const [budgetCost, setBudgetCost] = useState(0);
  const [advancePct, setAdvancePct] = useState(0);
  const [retentionPct, setRetentionPct] = useState(5.00);
  const [dlpMonths, setDlpMonths] = useState(12);
  const [siraApplicable, setSiraApplicable] = useState(false);
  const [clientLpoNumber, setClientLpoNumber] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [plannedEndDate, setPlannedEndDate] = useState('');

  // 3. Milestones State
  const [milestones, setMilestones] = useState<{ title: string; payment_linked: boolean; payment_pct: number; sort_order: number }[]>([
    { title: 'Mobilization & Material Submittal', payment_linked: false, payment_pct: 0, sort_order: 1 },
    { title: 'First Fix Installation & Conduit Piping', payment_linked: true, payment_pct: 30, sort_order: 2 },
    { title: 'Second Fix Cable Pulling & Device Fitting', payment_linked: true, payment_pct: 40, sort_order: 3 },
    { title: 'Testing, Commissioning & SIRA Inspection', payment_linked: true, payment_pct: 20, sort_order: 4 },
    { title: 'Handover & Training', payment_linked: true, payment_pct: 10, sort_order: 5 }
  ]);

  // Load dropdown selectors
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Clients
        const { data: clientData } = await supabase.from('clients').select('id, name');
        setClients(clientData || []);

        // Profiles - PMs (role=manager / admin) & Engineers (role=engineer)
        const { data: pmProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .in('role', ['manager', 'admin']);
        setManagers(pmProfiles || []);

        const { data: engProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('role', 'engineer');
        setEngineers(engProfiles || []);

        // If quotationId is passed, load and pre-fill details
        if (quotationId) {
          const { data: quote } = await supabase
            .from('quotations')
            .select('*')
            .eq('id', quotationId)
            .single();

          if (quote) {
            setName(quote.subject || '');
            setClientId(quote.client_id || '');
            setClientName(quote.client_name || '');
            setContractValue(Number(quote.subtotal_after_discount) || 0);
            setClientLpoNumber(quote.client_po_number || '');
            setPaymentTerms(quote.payment_terms || '');
            
            // Fetch quote lines to extract systems
            const { data: lines } = await supabase
              .from('quotation_lines')
              .select('system')
              .eq('quotation_id', quotationId);

            if (lines) {
              const uniqueSystems = Array.from(new Set(lines.map(l => l.system).filter(Boolean))) as ProjectSystem[];
              setSystems(uniqueSystems);
              setSiraApplicable(uniqueSystems.includes('CCTV') || uniqueSystems.includes('ACCESS_CONTROL'));
            }
          }
        }
      } catch (err) {
        logger.error('Error loading wizard dependencies:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [quotationId]);

  // Handle client selection to sync client name
  const handleClientChange = (cId: string) => {
    setClientId(cId);
    const client = clients.find(c => c.id === cId);
    setClientName(client ? client.name : '');
  };

  // Toggle systems checkbox
  const handleSystemToggle = (sys: ProjectSystem) => {
    setSystems(prev => 
      prev.includes(sys) ? prev.filter(s => s !== sys) : [...prev, sys]
    );
  };

  const handleAddMilestone = () => {
    setMilestones(prev => [
      ...prev,
      { title: '', payment_linked: true, payment_pct: 0, sort_order: prev.length + 1 }
    ]);
  };

  const handleRemoveMilestone = (index: number) => {
    setMilestones(prev => prev.filter((_, idx) => idx !== index).map((m, idx) => ({ ...m, sort_order: idx + 1 })));
  };

  const handleMilestoneChange = (index: number, key: string, val: any) => {
    setMilestones(prev => prev.map((m, idx) => idx === index ? { ...m, [key]: val } : m));
  };

  const handleSaveProject = async () => {
    setSaving(true);
    setError(null);

    // Sum check for milestones payment percentage
    const paymentLinkedMilestones = milestones.filter(m => m.payment_linked);
    const sum = paymentLinkedMilestones.reduce((acc, m) => acc + Number(m.payment_pct), 0);
    
    if (paymentLinkedMilestones.length > 0 && sum !== 100) {
      setError(`Payment-linked milestones must sum to exactly 100%. Current sum: ${sum}%`);
      setSaving(false);
      return;
    }

    try {
      // Create project
      const created = await projectService.createProject({
        name,
        company_id: activeCompanyId || undefined,
        client_id: clientId,
        client_name: clientName,
        project_type: projectType,
        systems,
        project_manager_id: pmId || undefined,
        site_engineer_id: engineerId || undefined,
        emirate,
        site_address: siteAddress || undefined,
        makani_or_plot: makaniOrPlot || undefined,
        contract_value: contractValue,
        original_contract_value: contractValue,
        budget_cost: budgetCost,
        advance_pct: advancePct,
        retention_pct: retentionPct,
        dlp_months: dlpMonths,
        sira_applicable: siraApplicable,
        client_lpo_number: clientLpoNumber || undefined,
        payment_terms: paymentTerms || undefined,
        start_date: startDate || undefined,
        planned_end_date: plannedEndDate || undefined,
        status: 'MOBILIZATION'
      });

      // Insert milestones
      const milestonesData = milestones.map(m => ({
        project_id: created.id,
        title: m.title || 'Untitled Stage',
        status: 'PENDING' as const,
        payment_linked: m.payment_linked,
        payment_pct: m.payment_linked ? m.payment_pct : null,
        sort_order: m.sort_order
      }));

      if (milestonesData.length > 0) {
        await supabase.from('project_milestones').insert(milestonesData);
      }

      router.push(`/projects/${created.id}`);
    } catch (err: any) {
      logger.error(err);
      setError(err.message || 'An error occurred while creating the project.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
        <p>Loading project wizard dependencies...</p>
      </div>
    );
  }

  const SYSTEM_LIST: ProjectSystem[] = [
    'CCTV', 'ACCESS_CONTROL', 'FIRE_ALARM', 'BMS', 
    'STRUCTURED_CABLING', 'PA_AV_BGM', 'GATE_BARRIER', 
    'KNX_SMART_HOME', 'ELECTRICAL', 'OTHER'
  ];

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Step Indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', borderBottom: '1px solid var(--surface-hover)', paddingBottom: '1rem' }}>
        {[
          { step: 1, label: 'Basics' },
          { step: 2, label: 'Commercials' },
          { step: 3, label: 'Milestones' },
          { step: 4, label: 'Review' }
        ].map((s) => (
          <div 
            key={s.step} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              color: step === s.step ? 'var(--primary)' : step > s.step ? '#10b981' : 'var(--text-muted)',
              fontSize: '0.85rem',
              fontWeight: step >= s.step ? 700 : 500
            }}
          >
            <span 
              style={{ 
                width: '24px', 
                height: '24px', 
                borderRadius: '50%', 
                border: '1.5px solid', 
                borderColor: step === s.step ? 'var(--primary)' : step > s.step ? '#10b981' : 'var(--border-color)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem'
              }}
            >
              {s.step}
            </span>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="quote-card">
        {/* STEP 1: BASICS */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h2 className="quote-card-title" style={{ fontSize: '1.2rem' }}><Briefcase size={20} /> Step 1: Project Basics</h2>
            
            <div className="quote-form-group">
              <label>Project Name / Scope title</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="quote-form-input" 
                placeholder="E.g. Security Systems Installation for Prime Tower"
                required 
              />
            </div>

            <div className="quote-form-grid">
              <div className="quote-form-group">
                <label>Client Partner</label>
                <select 
                  value={clientId} 
                  onChange={(e) => handleClientChange(e.target.value)} 
                  className="quote-filter-input"
                  required
                >
                  <option value="">-- Choose client --</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="quote-form-group">
                <label>Project Type</label>
                <select 
                  value={projectType} 
                  onChange={(e) => setProjectType(e.target.value as ProjectType)} 
                  className="quote-filter-input"
                  required
                >
                  <option value="SUPPLY_INSTALL">Supply & Install</option>
                  <option value="SUPPLY_ONLY">Supply Only</option>
                  <option value="INSTALL_ONLY">Install Only</option>
                  <option value="FITOUT">Fit-out</option>
                  <option value="AMC">Annual Maintenance Contract (AMC)</option>
                  <option value="CONSULTANCY">Consultancy</option>
                </select>
              </div>
            </div>

            <div className="quote-form-grid">
              <div className="quote-form-group">
                <label>Project Manager (PM)</label>
                <select 
                  value={pmId} 
                  onChange={(e) => setPmId(e.target.value)} 
                  className="quote-filter-input"
                >
                  <option value="">-- Assign PM --</option>
                  {managers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </div>

              <div className="quote-form-group">
                <label>Lead Site Engineer</label>
                <select 
                  value={engineerId} 
                  onChange={(e) => setEngineerId(e.target.value)} 
                  className="quote-filter-input"
                >
                  <option value="">-- Assign Site Engineer --</option>
                  {engineers.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </div>
            </div>

            <div className="quote-form-grid">
              <div className="quote-form-group">
                <label>Emirate Location</label>
                <select 
                  value={emirate} 
                  onChange={(e) => setEmirate(e.target.value as Emirate)} 
                  className="quote-filter-input"
                >
                  <option value="DUBAI">Dubai</option>
                  <option value="ABU_DHABI">Abu Dhabi</option>
                  <option value="SHARJAH">Sharjah</option>
                  <option value="AJMAN">Ajman</option>
                  <option value="RAK">Ras Al Khaimah</option>
                  <option value="FUJAIRAH">Fujairah</option>
                  <option value="UAQ">Umm Al Quwain</option>
                </select>
              </div>

              <div className="quote-form-group">
                <label>Plot / Makani Number</label>
                <input 
                  type="text" 
                  value={makaniOrPlot} 
                  onChange={(e) => setMakaniOrPlot(e.target.value)} 
                  className="quote-form-input" 
                  placeholder="E.g. Plot 343-982 or Makani 32412 87989"
                />
              </div>
            </div>

            <div className="quote-form-group">
              <label>Site Address</label>
              <input 
                type="text" 
                value={siteAddress} 
                onChange={(e) => setSiteAddress(e.target.value)} 
                className="quote-form-input" 
                placeholder="E.g. Business Bay, Floor 18"
              />
            </div>

            <div className="quote-form-group">
              <label style={{ marginBottom: '0.5rem' }}>Systems & Disciplines Included</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.8rem', background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--surface-hover)' }}>
                {SYSTEM_LIST.map((sys) => (
                  <label key={sys} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                    <input 
                      type="checkbox" 
                      checked={systems.includes(sys)}
                      onChange={() => handleSystemToggle(sys)}
                      style={{ width: '15px', height: '15px', accentColor: 'var(--primary)' }}
                    />
                    {sys.replace('_', ' ')}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: COMMERCIALS */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h2 className="quote-card-title" style={{ fontSize: '1.2rem' }}><DollarSign size={20} /> Step 2: Commercial & Financial Terms</h2>
            
            <div className="quote-form-grid">
              <div className="quote-form-group">
                <label>Contract Value (AED, Ex. VAT)</label>
                <input 
                  type="number" 
                  value={contractValue} 
                  onChange={(e) => setContractValue(Math.max(0, Number(e.target.value)))} 
                  className="quote-form-input" 
                  placeholder="AED 0.00"
                  required 
                />
              </div>

              <div className="quote-form-group">
                <label>Budget Cost (AED, Target Cost)</label>
                <input 
                  type="number" 
                  value={budgetCost} 
                  onChange={(e) => setBudgetCost(Math.max(0, Number(e.target.value)))} 
                  className="quote-form-input" 
                  placeholder="AED 0.00" 
                />
              </div>
            </div>

            <div className="quote-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <div className="quote-form-group">
                <label>Advance Payment (%)</label>
                <input 
                  type="number" 
                  value={advancePct} 
                  onChange={(e) => setAdvancePct(Math.min(100, Math.max(0, Number(e.target.value))))} 
                  className="quote-form-input" 
                  placeholder="10%" 
                />
              </div>

              <div className="quote-form-group">
                <label>Retention (%)</label>
                <input 
                  type="number" 
                  value={retentionPct} 
                  onChange={(e) => setRetentionPct(Math.min(100, Math.max(0, Number(e.target.value))))} 
                  className="quote-form-input" 
                  placeholder="5%" 
                />
              </div>

              <div className="quote-form-group">
                <label>DLP/Warranty Period (Months)</label>
                <input 
                  type="number" 
                  value={dlpMonths} 
                  onChange={(e) => setDlpMonths(Math.max(0, Number(e.target.value)))} 
                  className="quote-form-input" 
                  placeholder="12 months" 
                />
              </div>
            </div>

            <div className="quote-form-grid">
              <div className="quote-form-group">
                <label>Client LPO Reference / Award Ref</label>
                <input 
                  type="text" 
                  value={clientLpoNumber} 
                  onChange={(e) => setClientLpoNumber(e.target.value)} 
                  className="quote-form-input" 
                  placeholder="E.g. LPO-98765-2026" 
                />
              </div>

              <div className="quote-form-group">
                <label>Payment Terms Details</label>
                <input 
                  type="text" 
                  value={paymentTerms} 
                  onChange={(e) => setPaymentTerms(e.target.value)} 
                  className="quote-form-input" 
                  placeholder="E.g. 30 Days after invoice approval" 
                />
              </div>
            </div>

            <div className="quote-form-grid">
              <div className="quote-form-group">
                <label>Mobilization / Start Date</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  className="quote-form-input" 
                />
              </div>

              <div className="quote-form-group">
                <label>Planned Handover / End Date</label>
                <input 
                  type="date" 
                  value={plannedEndDate} 
                  onChange={(e) => setPlannedEndDate(e.target.value)} 
                  className="quote-form-input" 
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'color-mix(in srgb, var(--primary) 3%, transparent)', padding: '1rem', borderRadius: '8px', border: '1px solid color-mix(in srgb, var(--primary) 10%, transparent)' }}>
              <input 
                type="checkbox" 
                id="sira_ch"
                checked={siraApplicable} 
                onChange={(e) => setSiraApplicable(e.target.checked)} 
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
              />
              <label htmlFor="sira_ch" style={{ fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 600 }}>
                This is a SIRA Regulatory compliance project (requires CCTV/Access control inspection & approval)
              </label>
            </div>
          </div>
        )}

        {/* STEP 3: MILESTONES */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="quote-card-title" style={{ fontSize: '1.2rem' }}><Calendar size={20} /> Step 3: Project Milestones & Billing Weight</h2>
              <button type="button" className="quote-btn quote-btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={handleAddMilestone}>
                <Plus size={12} /> Add Milestone
              </button>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Milestones represent key stages of execution. Mark checkmarks for milestones that trigger progress billing. The payment percentages of checked milestones must sum to exactly 100%.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {milestones.map((m, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    display: 'flex', 
                    gap: '1rem', 
                    alignItems: 'center', 
                    padding: '0.8rem', 
                    background: 'var(--surface-hover)', 
                    border: '1px solid var(--surface-hover)', 
                    borderRadius: '8px' 
                  }}
                >
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', width: '25px' }}>
                    #{m.sort_order}
                  </span>
                  
                  <input 
                    type="text"
                    value={m.title}
                    onChange={(e) => handleMilestoneChange(idx, 'title', e.target.value)}
                    className="quote-form-input"
                    style={{ flex: 1 }}
                    placeholder="Milestone title"
                    required
                  />

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input 
                      type="checkbox"
                      checked={m.payment_linked}
                      onChange={(e) => handleMilestoneChange(idx, 'payment_linked', e.target.checked)}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    Bill Trigger
                  </label>

                  {m.payment_linked && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <input 
                        type="number"
                        value={m.payment_pct}
                        onChange={(e) => handleMilestoneChange(idx, 'payment_pct', Number(e.target.value))}
                        className="quote-form-input"
                        style={{ width: '70px', padding: '0.4rem' }}
                        placeholder="Pct"
                        min={0}
                        max={100}
                        required
                      />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>%</span>
                    </div>
                  )}

                  <button 
                    type="button" 
                    className="quote-btn quote-btn-danger" 
                    style={{ padding: '0.4rem' }}
                    onClick={() => handleRemoveMilestone(idx)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            {/* Live total tracking */}
            <div style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 700, color: milestones.filter(m=>m.payment_linked).reduce((s,m)=>s+m.payment_pct,0) === 100 ? '#10b981' : 'var(--warning)' }}>
              Billing Milestones Total: {milestones.filter(m=>m.payment_linked).reduce((s,m)=>s+m.payment_pct,0)}% / 100%
            </div>
          </div>
        )}

        {/* STEP 4: REVIEW & SUBMIT */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h2 className="quote-card-title" style={{ fontSize: '1.2rem' }}><Briefcase size={20} /> Step 4: Review and Confirm Project Setup</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', background: 'rgba(0,0,0,0.15)', padding: '1.2rem', borderRadius: '8px', border: '1px solid var(--surface-hover)' }}>
              <div>
                <h4 style={{ color: 'var(--secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Basics</h4>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>{name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Client: {clientName}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Type: {projectType.replace('_', ' ')}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Location: {emirate}</div>
                {systems.length > 0 && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {systems.map(s => <span key={s} style={{ fontSize: '0.65rem', background: 'var(--surface-hover)', padding: '2px 6px', borderRadius: '4px' }}>{s}</span>)}
                  </div>
                )}
              </div>

              <div>
                <h4 style={{ color: 'var(--secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Commercials</h4>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)' }}>AED {contractValue.toLocaleString()}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>LPO: {clientLpoNumber || 'N/A'}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>DLP period: {dlpMonths} months</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>SIRA regulatory check: {siraApplicable ? 'Yes' : 'No'}</div>
              </div>
            </div>

            <div>
              <h4 style={{ color: 'var(--secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Milestones Schema</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {milestones.map((m, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.3rem 0.5rem', background: 'var(--surface-hover)', borderRadius: '4px' }}>
                    <span>#{m.sort_order} {m.title}</span>
                    <span style={{ fontWeight: 600, color: m.payment_linked ? 'var(--secondary)' : 'var(--text-muted)' }}>
                      {m.payment_linked ? `Billing: ${m.payment_pct}%` : 'Visual track'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ color: '#ef4444', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.6rem', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                {error}
              </div>
            )}
          </div>
        )}

        {/* Wizard Footer controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.8rem', borderTop: '1px solid var(--surface-hover)', paddingTop: '1.2rem' }}>
          <button 
            type="button" 
            className="quote-btn quote-btn-secondary" 
            onClick={() => {
              if (step === 1) router.back();
              else setStep(step - 1);
            }}
            disabled={saving}
          >
            Back
          </button>
          
          <button 
            type="button" 
            className="quote-btn quote-btn-primary" 
            onClick={() => {
              if (step < 4) {
                // simple validator
                if (step === 1 && (!name.trim() || !clientId)) {
                  setError('Project name and client are required.');
                  return;
                }
                setError(null);
                setStep(step + 1);
              } else {
                handleSaveProject();
              }
            }}
            disabled={saving}
          >
            {step < 4 ? 'Next' : saving ? 'Creating...' : 'Initialize Project'}
          </button>
        </div>
      </div>
    </div>
  );
};
