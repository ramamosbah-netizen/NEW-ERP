// ============================================================
// JEET ERP — AMC Contract Detail & Sub-Registers
// Route: /amc/[id]
// ============================================================

'use client';
import { logger } from '@/lib/logger';

import { useState, use, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Play, 
  Plus, 
  Trash, 
  Settings, 
  Layers, 
  Cpu, 
  DollarSign, 
  Calendar, 
  User, 
  FileText,
  AlertTriangle,
  X
} from 'lucide-react';
import { useAMCContract } from '@/hooks/useAMCContracts';
import { AMC_STATUS_LABELS, AMC_STATUS_COLORS, AMC_TYPE_LABELS, SLA_TIER_LABELS, BILLING_FREQUENCY_LABELS, EQUIPMENT_CONDITION_LABELS } from '@/constants/amc.constants';
import { supabase } from '@/lib/supabase';
import type { AMCContractStatus } from '@/types/amc.types';

const fmtAED = (v: number) => {
  return new Intl.NumberFormat('en-AE', { 
    style: 'currency', 
    currency: 'AED', 
    minimumFractionDigits: 2 
  }).format(v);
};

export default function AMCDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { contract, loading, error, refetch, activateContract, addEquipment } = useAMCContract(id);

  const [activeTab, setActiveTab] = useState<'equipment' | 'billing' | 'visits'>('equipment');
  const [showAddEquipmentModal, setShowAddEquipmentModal] = useState(false);
  const [technicians, setTechnicians] = useState<any[]>([]);

  // Equipment Form State
  const [eqForm, setEqForm] = useState({
    system: 'CCTV',
    equipment_type: '',
    brand: '',
    model: '',
    serial_no: '',
    location_label: '',
    condition: 'GOOD' as any,
    install_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Fetch Technicians on mount
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['technician', 'engineer'])
      .then(({ data }) => {
        if (data) setTechnicians(data);
      });
  }, []);

  const handleActivate = async () => {
    if (confirm('Are you sure you want to activate this contract? This will generate the scheduled visits and billing schedule.')) {
      try {
        await activateContract();
        alert('Contract successfully activated!');
      } catch (err: any) {
        alert('Failed to activate contract: ' + err.message);
      }
    }
  };

  const handleAddEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eqForm.equipment_type || !eqForm.brand || !eqForm.model || !eqForm.location_label) {
      alert('Please fill in required fields (Type, Brand, Model, Location)');
      return;
    }
    try {
      await addEquipment([eqForm]);
      setShowAddEquipmentModal(false);
      setEqForm({
        system: contract?.systems?.[0] || 'CCTV',
        equipment_type: '',
        brand: '',
        model: '',
        serial_no: '',
        location_label: '',
        condition: 'GOOD',
        install_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
    } catch (err: any) {
      alert('Failed to add equipment: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="quote-container">
        <div className="quote-card" style={{ textAlign: 'center', padding: '4rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
          <p>Loading contract details...</p>
        </div>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="quote-container">
        <div className="quote-card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--error)' }}>
          <p>Error: {error ? error.message : 'Contract not found'}</p>
          <Link href="/amc" style={{ color: 'var(--primary)', display: 'block', marginTop: '1rem' }}>Back to Registry</Link>
        </div>
      </div>
    );
  }

  const statusColors = AMC_STATUS_COLORS[contract.status as AMCContractStatus] || AMC_STATUS_COLORS.DRAFT;

  return (
    <div className="quote-container">
      {/* Back navigation */}
      <Link href="/amc" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', textDecoration: 'none', fontSize: '0.82rem', marginBottom: '1.2rem', fontWeight: 600 }}>
        <ArrowLeft size={14} /> Back to Registry
      </Link>

      {/* Detail Header */}
      <header className="quote-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
            <h1 className="quote-header-title">{contract.contract_number}</h1>
            <span 
              className="q-badge" 
              style={{ 
                background: statusColors.bg, 
                color: statusColors.text, 
                borderColor: statusColors.border 
              }}
            >
              {AMC_STATUS_LABELS[contract.status] || contract.status}
            </span>
          </div>
          <p className="quote-header-subtitle">
            Client: <strong style={{ color: '#fff' }}>{contract.client_name}</strong> | Site: <strong style={{ color: '#fff' }}>{contract.site_name}</strong>
          </p>
        </div>

        {/* Action Button */}
        {(contract.status === 'DRAFT' || contract.status === 'PENDING_APPROVAL') && (
          <button 
            type="button" 
            className="quote-btn quote-btn-primary" 
            onClick={handleActivate}
            style={{ minWidth: '160px' }}
          >
            <Play size={16} /> Activate Contract
          </button>
        )}
      </header>

      {/* Grid: Coordinates & Details */}
      <div className="quote-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginBottom: '1.5rem' }}>
        {/* Panel 1: Site Coordinates */}
        <div className="quote-card" style={{ marginBottom: 0 }}>
          <div className="quote-card-header">
            <h3 className="quote-card-title"><Layers size={16} /> Client & Site Coordinates</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>TRN Number:</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{contract.client_trn || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Site Name:</span>
              <span>{contract.site_name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Site Address:</span>
              <span>{contract.site_address}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Emirate:</span>
              <span>{contract.emirate}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>SIRA Linked:</span>
              <span style={{ color: contract.sira_linked ? 'var(--primary)' : 'var(--text-muted)' }}>
                {contract.sira_linked ? 'YES (Regulated)' : 'NO'}
              </span>
            </div>
            {contract.sira_linked && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>SIRA Expiry:</span>
                <span>{contract.sira_expiry_date ? new Date(contract.sira_expiry_date).toLocaleDateString('en-GB') : '—'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Panel 2: Contract Specifications */}
        <div className="quote-card" style={{ marginBottom: 0 }}>
          <div className="quote-card-header">
            <h3 className="quote-card-title"><Cpu size={16} /> Contract Specifications</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Contract Type:</span>
              <span>{AMC_TYPE_LABELS[contract.contract_type] || contract.contract_type}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>SLA Tier:</span>
              <span style={{ fontWeight: 600, color: contract.sla_tier === 'CRITICAL' ? 'var(--error)' : 'var(--text-primary)' }}>{SLA_TIER_LABELS[contract.sla_tier] || contract.sla_tier}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>SLA Timers:</span>
              <span>{contract.response_hours}h Response / {contract.resolution_hours}h Resolution</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Visits / Year:</span>
              <span>{contract.visits_per_year} PPM Visits</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Parts Coverage:</span>
              <span>
                {contract.parts_included 
                  ? `INCLUDED ${contract.parts_cap_aed ? `(Cap: ${contract.parts_cap_aed} AED)` : '(No Cap)'}` 
                  : 'EXCLUDED'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Emergency Callouts:</span>
              <span>{contract.emergency_callouts_included ? `${contract.emergency_callouts_included} Visits` : 'Unlimited'}</span>
            </div>
          </div>
        </div>

        {/* Panel 3: Financial Matrix */}
        <div className="quote-card" style={{ marginBottom: 0 }}>
          <div className="quote-card-header">
            <h3 className="quote-card-title"><DollarSign size={16} /> Financial Matrix</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Annual Value:</span>
              <span style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{fmtAED(contract.annual_value)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Billing Frequency:</span>
              <span>{BILLING_FREQUENCY_LABELS[contract.billing_frequency] || contract.billing_frequency}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Contract Duration:</span>
              <span>1 Year ({new Date(contract.start_date).toLocaleDateString('en-GB')} – {new Date(contract.end_date).toLocaleDateString('en-GB')})</span>
            </div>
            {contract.origin_quotation_id && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Converted From Quote:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  <Link href={`/quotations/${contract.origin_quotation_id}`} style={{ color: 'var(--secondary)' }}>View Quotation</Link>
                </span>
              </div>
            )}
            {contract.origin_project_id && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Origin Project:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  <Link href={`/projects/${contract.origin_project_id}`} style={{ color: 'var(--secondary)' }}>View Project</Link>
                </span>
              </div>
            )}
            {contract.contract_document_id && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Filed Contract Document:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  <Link href={`/documents/${contract.contract_document_id}`} style={{ color: 'var(--secondary)' }}>Open DMS File</Link>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="quote-tabs">
        <button 
          className={`quote-tab ${activeTab === 'equipment' ? 'active' : ''}`}
          onClick={() => setActiveTab('equipment')}
        >
          Asset Register ({contract.equipment?.length || 0})
        </button>
        <button 
          className={`quote-tab ${activeTab === 'billing' ? 'active' : ''}`}
          onClick={() => setActiveTab('billing')}
        >
          Billing Schedule ({contract.billing_schedule?.length || 0})
        </button>
        <button 
          className={`quote-tab ${activeTab === 'visits' ? 'active' : ''}`}
          onClick={() => setActiveTab('visits')}
        >
          PPM Scheduled Visits
        </button>
      </div>

      {/* Tab Panel Content */}
      <div className="quote-card" style={{ padding: 0 }}>
        {/* TAB 1: ASSET REGISTER */}
        {activeTab === 'equipment' && (
          <div style={{ padding: '1.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Covered Assets & Equipment Register</h4>
              <button 
                type="button" 
                className="quote-btn quote-btn-primary" 
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                onClick={() => setShowAddEquipmentModal(true)}
              >
                <Plus size={14} /> Add Asset
              </button>
            </div>

            {(!contract.equipment || contract.equipment.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', border: '1px dashed var(--surface-hover)', borderRadius: '8px' }}>
                <Cpu size={36} style={{ margin: '0 auto 0.8rem auto', opacity: 0.2 }} />
                <p>No equipment assets registered under this contract yet.</p>
              </div>
            ) : (
              <div className="quote-table-wrap">
                <table className="quote-table">
                  <thead>
                    <tr>
                      <th>System</th>
                      <th>Equipment Type</th>
                      <th>Brand / Model</th>
                      <th>Serial No</th>
                      <th>Location</th>
                      <th>Install Date</th>
                      <th>Condition</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contract.equipment.map((eq) => (
                      <tr key={eq.id}>
                        <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{eq.system}</td>
                        <td>{eq.equipment_type}</td>
                        <td>{eq.brand} / {eq.model}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{eq.serial_no || '—'}</td>
                        <td>{eq.location_label}</td>
                        <td>{eq.install_date ? new Date(eq.install_date).toLocaleDateString('en-GB') : '—'}</td>
                        <td>
                          <span 
                            style={{ 
                              fontSize: '0.7rem', 
                              fontWeight: 700, 
                              padding: '2px 6px', 
                              borderRadius: '4px',
                              background: eq.condition === 'GOOD' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                              color: eq.condition === 'GOOD' ? 'var(--success)' : 'var(--error)'
                            }}
                          >
                            {EQUIPMENT_CONDITION_LABELS[eq.condition]}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{eq.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BILLING SCHEDULE */}
        {activeTab === 'billing' && (
          <div style={{ padding: '1.2rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Invoicing Installments Schedule</h4>

            {(!contract.billing_schedule || contract.billing_schedule.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <p>Billing schedule has not been generated. It will be generated when the contract is activated.</p>
              </div>
            ) : (
              <div className="quote-table-wrap">
                <table className="quote-table">
                  <thead>
                    <tr>
                      <th>Installment Seq</th>
                      <th>Due Date</th>
                      <th>Amount (AED)</th>
                      <th>Status</th>
                      <th>Tax Invoice Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contract.billing_schedule.map((item) => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 700 }}>Seq #{item.sequence}</td>
                        <td>{new Date(item.due_date).toLocaleDateString('en-GB')}</td>
                        <td style={{ fontWeight: 600, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{fmtAED(item.amount)}</td>
                        <td>
                          <span 
                            className="q-badge" 
                            style={{ 
                              background: item.status === 'PAID' ? 'rgba(16,185,129,0.1)' : item.status === 'INVOICED' ? 'rgba(234,179,8,0.1)' : 'var(--surface-hover)',
                              color: item.status === 'PAID' ? 'var(--success)' : item.status === 'INVOICED' ? 'var(--warning)' : 'var(--text-secondary)'
                            }}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td>
                          {item.invoice_id ? (
                            <Link href={`/finance/ar`} style={{ color: 'var(--secondary)', textDecoration: 'underline' }}>
                              Open Invoice Draft
                            </Link>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Pending Due Date</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PPM SCHEDULED VISITS */}
        {activeTab === 'visits' && (
          <div style={{ padding: '1.2rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>PPM Maintenance Visit Planner</h4>

            <Suspense fallback={<p>Loading visits list...</p>}>
              <AMCVisitsList contractId={id} technicians={technicians} onRefetch={refetch} status={contract.status} />
            </Suspense>
          </div>
        )}
      </div>

      {/* MODAL: ADD EQUIPMENT ASSET */}
      {showAddEquipmentModal && (
        <div className="quote-modal-overlay">
          <div className="quote-modal" style={{ maxWidth: '500px' }}>
            <div className="quote-modal-header">
              <h3 className="quote-modal-title"><Cpu size={16} /> Register Asset Equipment</h3>
              <button 
                type="button" 
                onClick={() => setShowAddEquipmentModal(false)}
                style={{ background: 'transparent', color: '#fff', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="quote-modal-body">
              <form onSubmit={handleAddEquipment}>
                <div className="quote-form-grid" style={{ gridTemplateColumns: '1fr', gap: '1rem' }}>
                  
                  {/* System Select */}
                  <div className="quote-form-group">
                    <label>Covered System</label>
                    <select
                      name="system"
                      className="quote-form-input"
                      value={eqForm.system}
                      onChange={(e) => setEqForm(prev => ({ ...prev, system: e.target.value }))}
                    >
                      {contract.systems?.map(sys => (
                        <option key={sys} value={sys}>{sys}</option>
                      ))}
                    </select>
                  </div>

                  {/* Equipment Type */}
                  <div className="quote-form-group">
                    <label>Equipment Type *</label>
                    <input
                      type="text"
                      name="equipment_type"
                      className="quote-form-input"
                      placeholder="e.g. Dome IP Camera, Magnetic Lock, Gate Arm"
                      value={eqForm.equipment_type}
                      onChange={(e) => setEqForm(prev => ({ ...prev, equipment_type: e.target.value }))}
                      required
                    />
                  </div>

                  {/* Brand & Model */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="quote-form-group">
                      <label>Brand *</label>
                      <input
                        type="text"
                        name="brand"
                        className="quote-form-input"
                        placeholder="e.g. Hikvision, Nedap"
                        value={eqForm.brand}
                        onChange={(e) => setEqForm(prev => ({ ...prev, brand: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="quote-form-group">
                      <label>Model *</label>
                      <input
                        type="text"
                        name="model"
                        className="quote-form-input"
                        placeholder="Model number"
                        value={eqForm.model}
                        onChange={(e) => setEqForm(prev => ({ ...prev, model: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  {/* Serial No */}
                  <div className="quote-form-group">
                    <label>Serial Number</label>
                    <input
                      type="text"
                      name="serial_no"
                      className="quote-form-input"
                      placeholder="Product S/N tag"
                      value={eqForm.serial_no}
                      onChange={(e) => setEqForm(prev => ({ ...prev, serial_no: e.target.value }))}
                    />
                  </div>

                  {/* Location label */}
                  <div className="quote-form-group">
                    <label>Installed Location Label *</label>
                    <input
                      type="text"
                      name="location_label"
                      className="quote-form-input"
                      placeholder="e.g. Main Entrance Gate, server room rack"
                      value={eqForm.location_label}
                      onChange={(e) => setEqForm(prev => ({ ...prev, location_label: e.target.value }))}
                      required
                    />
                  </div>

                  {/* Condition & Install Date */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="quote-form-group">
                      <label>Physical Condition</label>
                      <select
                        name="condition"
                        className="quote-form-input"
                        value={eqForm.condition}
                        onChange={(e) => setEqForm(prev => ({ ...prev, condition: e.target.value as any }))}
                      >
                        <option value="GOOD">Good (Operational)</option>
                        <option value="FAIR">Fair (Needs monitoring)</option>
                        <option value="POOR">Poor (Recommend Replace)</option>
                        <option value="FAULTY">Faulty (Inoperable)</option>
                      </select>
                    </div>
                    <div className="quote-form-group">
                      <label>Install Date</label>
                      <input
                        type="date"
                        name="install_date"
                        className="quote-form-input"
                        value={eqForm.install_date}
                        onChange={(e) => setEqForm(prev => ({ ...prev, install_date: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="quote-form-group">
                    <label>Maintenance Notes</label>
                    <input
                      type="text"
                      name="notes"
                      className="quote-form-input"
                      value={eqForm.notes}
                      onChange={(e) => setEqForm(prev => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '1.5rem' }}>
                  <button type="button" className="quote-btn quote-btn-secondary" onClick={() => setShowAddEquipmentModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="quote-btn quote-btn-primary">
                    Register Asset
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// SUB-COMPONENT: LIST CONTRACT VISITS
function AMCVisitsList({ contractId, technicians, onRefetch, status }: { contractId: string; technicians: any[]; onRefetch: () => void; status: string }) {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [schedulingVisitId, setSchedulingVisitId] = useState<string | null>(null);

  // Scheduling Form
  const [schedForm, setSchedForm] = useState({
    date: new Date().toISOString().split('T')[0],
    slot: 'AM' as 'AM' | 'PM',
    tech_id: '',
    tech2_id: ''
  });

  const loadVisits = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ppm_visits')
        .select('*, profiles!ppm_visits_technician_id_fkey(full_name)')
        .eq('contract_id', contractId)
        .order('target_month', { ascending: true });

      if (error) throw error;
      setVisits(data || []);
    } catch (err) {
      logger.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVisits();
  }, [contractId]);

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedForm.tech_id || !schedForm.date) {
      alert('Please select a technician and scheduling date.');
      return;
    }

    try {
      // Direct call service layer or client
      const { visitService } = await import('@/services/visitService');
      await visitService.schedulePPMVisit(
        schedulingVisitId!,
        schedForm.date,
        schedForm.slot,
        schedForm.tech_id,
        schedForm.tech2_id || undefined
      );

      setSchedulingVisitId(null);
      alert('Visit scheduled successfully!');
      loadVisits();
      onRefetch();
    } catch (err: any) {
      alert('Failed to schedule visit: ' + err.message);
    }
  };

  if (loading) {
    return <p style={{ color: 'var(--text-secondary)' }}>Loading visits...</p>;
  }

  if (visits.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', border: '1px dashed var(--surface-hover)', borderRadius: '8px' }}>
        <Calendar size={36} style={{ margin: '0 auto 0.8rem auto', opacity: 0.2 }} />
        <p>Visits schedule has not been generated. It will be generated when the contract is activated.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="quote-table-wrap">
        <table className="quote-table">
          <thead>
            <tr>
              <th>Visit No</th>
              <th>Target Month</th>
              <th>Scheduled Date</th>
              <th>Slot</th>
              <th>Assigned Technician</th>
              <th>Status</th>
              <th style={{ textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {visits.map((v) => {
              const targetDate = new Date(v.target_month);
              const targetMonthStr = targetDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
              return (
                <tr key={v.id}>
                  <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{v.visit_number}</td>
                  <td style={{ fontWeight: 600 }}>{targetMonthStr}</td>
                  <td>{v.scheduled_date ? new Date(v.scheduled_date).toLocaleDateString('en-GB') : '—'}</td>
                  <td>{v.scheduled_slot || '—'}</td>
                  <td>{v.profiles?.full_name || 'Unassigned'}</td>
                  <td>
                    <span 
                      style={{ 
                        fontSize: '0.7rem', 
                        fontWeight: 700, 
                        padding: '2px 6px', 
                        borderRadius: '4px',
                        background: v.status === 'COMPLETED' ? 'rgba(16,185,129,0.1)' : v.status === 'SCHEDULED' ? 'rgba(14,165,233,0.1)' : 'var(--surface-hover)',
                        color: v.status === 'COMPLETED' ? 'var(--success)' : v.status === 'SCHEDULED' ? 'var(--secondary)' : 'var(--text-secondary)'
                      }}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {v.status === 'UNSCHEDULED' && status === 'ACTIVE' && (
                      <button 
                        type="button" 
                        className="quote-btn quote-btn-primary" 
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem' }}
                        onClick={() => {
                          setSchedulingVisitId(v.id);
                          setSchedForm(prev => ({ ...prev, tech_id: v.technician_id || '' }));
                        }}
                      >
                        Schedule
                      </button>
                    )}
                    {v.status === 'COMPLETED' && v.report_document_id && (
                      <Link 
                        href={`/documents/${v.report_document_id}`} 
                        className="quote-btn quote-btn-secondary" 
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem', textDecoration: 'none' }}
                      >
                        View Report
                      </Link>
                    )}
                    {v.status !== 'UNSCHEDULED' && v.status !== 'COMPLETED' && (
                      <Link 
                        href={`/ppm/execute/${v.id}`} 
                        className="quote-btn quote-btn-secondary" 
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem', textDecoration: 'none' }}
                      >
                        Run Visit
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* SCHEDULING DIALOG MODAL */}
      {schedulingVisitId && (
        <div className="quote-modal-overlay">
          <div className="quote-modal" style={{ maxWidth: '450px' }}>
            <div className="quote-modal-header">
              <h3 className="quote-modal-title"><Calendar size={16} /> Schedule Maintenance Visit</h3>
              <button 
                type="button" 
                onClick={() => setSchedulingVisitId(null)}
                style={{ background: 'transparent', color: '#fff', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="quote-modal-body">
              <form onSubmit={handleScheduleSubmit}>
                <div className="quote-form-grid" style={{ gridTemplateColumns: '1fr', gap: '1rem' }}>
                  
                  {/* Date */}
                  <div className="quote-form-group">
                    <label>Scheduled Date *</label>
                    <input
                      type="date"
                      name="date"
                      className="quote-form-input"
                      value={schedForm.date}
                      onChange={(e) => setSchedForm(prev => ({ ...prev, date: e.target.value }))}
                      required
                    />
                  </div>

                  {/* Slot */}
                  <div className="quote-form-group">
                    <label>Slot Timing</label>
                    <select
                      name="slot"
                      className="quote-form-input"
                      value={schedForm.slot}
                      onChange={(e) => setSchedForm(prev => ({ ...prev, slot: e.target.value as any }))}
                    >
                      <option value="AM">Morning (AM Slot: 08:00 - 13:00)</option>
                      <option value="PM">Afternoon (PM Slot: 13:00 - 18:00)</option>
                    </select>
                  </div>

                  {/* Tech 1 */}
                  <div className="quote-form-group">
                    <label>Lead Technician *</label>
                    <select
                      name="tech_id"
                      className="quote-form-input"
                      value={schedForm.tech_id}
                      onChange={(e) => setSchedForm(prev => ({ ...prev, tech_id: e.target.value }))}
                      required
                    >
                      <option value="">Select Technician</option>
                      {technicians.map((t) => (
                        <option key={t.id} value={t.id}>{t.full_name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Tech 2 */}
                  <div className="quote-form-group">
                    <label>Assisting Technician (Optional)</label>
                    <select
                      name="tech2_id"
                      className="quote-form-input"
                      value={schedForm.tech2_id}
                      onChange={(e) => setSchedForm(prev => ({ ...prev, tech2_id: e.target.value }))}
                    >
                      <option value="">None</option>
                      {technicians.map((t) => (
                        <option key={t.id} value={t.id}>{t.full_name}</option>
                      ))}
                    </select>
                  </div>

                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '1.5rem' }}>
                  <button type="button" className="quote-btn quote-btn-secondary" onClick={() => setSchedulingVisitId(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="quote-btn quote-btn-primary">
                    Schedule Visit
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
