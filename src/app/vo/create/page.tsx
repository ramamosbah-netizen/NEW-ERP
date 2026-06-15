// ============================================================
// JEET ERP — Variation Order (VO) Creation Wizard
// Routes: /vo/create
// Theme: Bloomberg Terminal Electric Mint
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { voService } from '@/services/voService';
import { VO_TYPES, VO_ORIGINS, VO_PRICING_BASIS, VO_WORK_STATUSES } from '@/constants/vo.constants';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Search, 
  ShieldAlert, 
  DollarSign, 
  FileText, 
  AlertTriangle,
  FolderOpen
} from 'lucide-react';

function VOCreatePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get('projectId') || '';

  // Options loaded from DB
  const [projects, setProjects] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  
  // Selected project BOQ items
  const [boqItems, setBoqItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingBOQ, setLoadingBOQ] = useState(false);

  // Form Fields
  const [projectId, setProjectId] = useState(initialProjectId);
  const [title, setTitle] = useState('');
  const [voType, setVoType] = useState<'ADDITION' | 'OMISSION' | 'SUBSTITUTION' | 'RATE_CHANGE' | 'DAYWORKS' | 'PROVISIONAL_SUM_ADJ'>('ADDITION');
  const [origin, setOrigin] = useState<'CLIENT_INSTRUCTION' | 'SITE_INSTRUCTION' | 'CONSULTANT' | 'RFI' | 'DESIGN_CHANGE' | 'SITE_CONDITION'>('CLIENT_INSTRUCTION');
  const [instructionReference, setInstructionReference] = useState('');
  const [instructionDate, setInstructionDate] = useState(new Date().toISOString().split('T')[0]);
  const [instructionDocId, setInstructionDocId] = useState('');
  const [pricingBasis, setPricingBasis] = useState<'BOQ_RATES' | 'NEW_RATES' | 'DAYWORKS' | 'NEGOTIATED'>('BOQ_RATES');
  const [description, setDescription] = useState('');
  const [justification, setJustification] = useState('');
  const [timeImpactDays, setTimeImpactDays] = useState(0);
  const [workStatus, setWorkStatus] = useState<'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'>('NOT_STARTED');

  // VO Line Items
  const [items, setItems] = useState<Array<{
    action: 'ADD' | 'OMIT' | 'RE_RATE';
    pricing_item_id?: string | null;
    boq_item_ref?: string | null;
    description: string;
    unit: string;
    quantity: number;
    unit_cost: number;
    unit_sell: number;
    system: string;
    notes?: string;
  }>>([
    { action: 'ADD', description: '', unit: 'Nos', quantity: 1, unit_cost: 0, unit_sell: 0, system: 'OTHER' }
  ]);

  // Modals / Item Picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTargetIndex, setPickerTargetIndex] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  // Load Projects and Documents
  useEffect(() => {
    supabase.from('projects').select('id, name, project_number, boq_id').eq('is_active', true).then(({ data }) => setProjects(data || []));
    supabase.from('documents')
      .select('id, title, original_filename')
      .eq('category', 'COMMERCIAL')
      .then(({ data }) => setDocuments(data || []));
  }, []);

  // Fetch project BOQ items when projectId changes
  useEffect(() => {
    async function loadBOQ() {
      if (projectId) {
        const selectedProj = projects.find(p => p.id === projectId);
        if (selectedProj && selectedProj.boq_id) {
          setLoadingBOQ(true);
          try {
            const { data } = await supabase.from('boqs')
              .select('items')
              .eq('id', selectedProj.boq_id)
              .single();
            if (data && Array.isArray(data.items)) {
              setBoqItems(data.items);
            } else {
              setBoqItems([]);
            }
          } catch (err) {
            console.error('Failed to load project BOQ:', err);
            setBoqItems([]);
          } finally {
            setLoadingBOQ(false);
          }
        } else {
          setBoqItems([]);
        }
      } else {
        setBoqItems([]);
      }
    }
    loadBOQ();
  }, [projectId, projects]);

  const handleItemChange = (index: number, key: string, val: any) => {
    const updated = [...items];
    (updated[index] as any)[key] = val;

    // For omissions, force negative quantity and cost/sell if positive was typed
    if (key === 'quantity' && updated[index].action === 'OMIT') {
      updated[index].quantity = -Math.abs(Number(val));
    }
    setItems(updated);
  };

  const handleActionChange = (index: number, action: 'ADD' | 'OMIT' | 'RE_RATE') => {
    const updated = [...items];
    updated[index].action = action;
    
    if (action === 'OMIT') {
      updated[index].quantity = -Math.abs(updated[index].quantity);
      // Trigger item picker modal
      setPickerTargetIndex(index);
      setPickerOpen(true);
    } else if (action === 'RE_RATE') {
      updated[index].quantity = Math.abs(updated[index].quantity);
      setPickerTargetIndex(index);
      setPickerOpen(true);
    } else {
      updated[index].quantity = Math.abs(updated[index].quantity);
      updated[index].boq_item_ref = null;
    }
    setItems(updated);
  };

  const addItemRow = () => {
    setItems(prev => [...prev, { action: 'ADD', description: '', unit: 'Nos', quantity: 1, unit_cost: 0, unit_sell: 0, system: 'OTHER' }]);
  };

  const removeItemRow = (index: number) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // BOQ Item Picker selection
  const selectBOQItem = (boqItem: any) => {
    if (pickerTargetIndex === null) return;
    const updated = [...items];
    const item = updated[pickerTargetIndex];
    
    item.boq_item_ref = boqItem.id || boqItem.name;
    item.description = boqItem.name;
    item.unit = boqItem.unit || 'Nos';
    item.unit_cost = boqItem.material_unit_cost || 0;
    item.unit_sell = boqItem.unit_price || 0;
    item.system = boqItem.system || 'OTHER';

    if (item.action === 'OMIT') {
      item.quantity = -Math.abs(boqItem.quantity || 1);
    } else {
      item.quantity = Math.abs(boqItem.quantity || 1);
    }

    setItems(updated);
    setPickerOpen(false);
    setPickerTargetIndex(null);
    setPickerSearch('');
  };

  // Math totals
  const subtotalCost = items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_cost || 0)), 0);
  const subtotalSell = items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_sell || 0)), 0);
  const vat = subtotalSell * 0.05;
  const totalInclVat = subtotalSell + vat;
  const marginAmount = subtotalSell - subtotalCost;
  const marginPct = subtotalSell !== 0 ? (marginAmount / subtotalSell) * 100 : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      alert('Please select associated project.');
      return;
    }
    if (!title.trim()) {
      alert('Please enter a Variation Order Title.');
      return;
    }
    if (!instructionReference.trim()) {
      alert('Please enter instruction reference (e.g. CVO-01, Letter ref).');
      return;
    }

    try {
      setLoading(true);

      const voData = {
        project_id: projectId,
        title,
        vo_type: voType,
        origin,
        instruction_reference: instructionReference,
        instruction_date: instructionDate,
        instruction_document_id: instructionDocId || null,
        pricing_basis: pricingBasis,
        description,
        justification,
        time_impact_days: Number(timeImpactDays) || 0,
        work_status: workStatus,
      };

      const result = await voService.createVODraft(voData as any, items);
      router.push(`/vo/${result.id}`);
    } catch (err: any) {
      console.error(err);
      alert('Failed to save Variation Order Draft: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredBOQItems = boqItems.filter(item => 
    item.name?.toLowerCase().includes(pickerSearch.toLowerCase()) ||
    item.system?.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text-primary)] flex flex-col font-sans">
<main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
        
        {/* Breadcrumb & Title */}
        <div>
          <div className="text-[10px] text-[var(--text-primary)]0 font-mono uppercase tracking-widest flex items-center gap-1">
            <Link href="/vo" className="hover:text-[var(--accent)] flex items-center gap-0.5"><ArrowLeft size={10} /> Registry</Link> &gt; <span>Capture Variation Order</span>
          </div>
          <h1 className="font-heading font-extrabold text-2xl tracking-tight text-[var(--text-primary)] uppercase mt-1">
            Capture Variation Order (VO)
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-6">
          
          {/* Main Form Fields */}
          <div className="flex-1 bg-[var(--bg-card)] border border-[var(--border)] rounded p-6 flex flex-col gap-5">
            <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider border-b border-[var(--border)] pb-2 flex justify-between items-center">
              <span>VO Parameters & Reference Metadata</span>
              {loadingBOQ && <span className="text-[10px] text-[var(--text-primary)]0 animate-pulse font-normal">Loading project BOQ...</span>}
            </h3>

            {/* Project & Title */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] text-[var(--text-secondary)] font-mono uppercase mb-1.5">Project Target</label>
                <select
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] font-mono"
                  required
                >
                  <option value="">Select Project...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.project_number} — {p.name}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] text-[var(--text-secondary)] font-mono uppercase mb-1.5">Variation Order Title</label>
                <input
                  type="text"
                  placeholder="e.g. Additional CCTV cameras on ground floor lobby..."
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
                  required
                />
              </div>
            </div>

            {/* VO Type, Origin, Basis */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] text-[var(--text-secondary)] font-mono uppercase mb-1.5">Variation Type</label>
                <select
                  value={voType}
                  onChange={e => setVoType(e.target.value as any)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
                >
                  {VO_TYPES.map(type => (
                    <option key={type} value={type}>{VO_TYPES.includes(type) ? type.replace(/_/g, ' ') : type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-secondary)] font-mono uppercase mb-1.5">Origin / Cause</label>
                <select
                  value={origin}
                  onChange={e => setOrigin(e.target.value as any)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
                >
                  {VO_ORIGINS.map(orig => (
                    <option key={orig} value={orig}>{VO_ORIGINS.includes(orig) ? orig.replace(/_/g, ' ') : orig}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-secondary)] font-mono uppercase mb-1.5">Pricing Basis</label>
                <select
                  value={pricingBasis}
                  onChange={e => setPricingBasis(e.target.value as any)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] font-mono"
                >
                  {VO_PRICING_BASIS.map(basis => (
                    <option key={basis} value={basis}>{basis.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Instruction ref, date, document */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] text-[var(--text-secondary)] font-mono uppercase mb-1.5">Instruction Reference</label>
                <input
                  type="text"
                  placeholder="e.g. CVI-901 / SITE-04"
                  value={instructionReference}
                  onChange={e => setInstructionReference(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-secondary)] font-mono uppercase mb-1.5">Instruction Date</label>
                <input
                  type="date"
                  value={instructionDate}
                  onChange={e => setInstructionDate(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-secondary)] font-mono uppercase mb-1.5">Link Written Directive (DMS)</label>
                <select
                  value={instructionDocId}
                  onChange={e => setInstructionDocId(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="">Choose instruction PDF...</option>
                  {documents.map(doc => (
                    <option key={doc.id} value={doc.id}>{doc.original_filename} ({doc.title})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Time impact and site status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-[var(--text-secondary)] font-mono uppercase mb-1.5">EOT Time Impact (Days)</label>
                <input
                  type="number"
                  min="0"
                  value={timeImpactDays}
                  onChange={e => setTimeImpactDays(Number(e.target.value))}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] font-mono text-right"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-secondary)] font-mono uppercase mb-1.5">Physical Site Progress</label>
                <select
                  value={workStatus}
                  onChange={e => setWorkStatus(e.target.value as any)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
                >
                  {VO_WORK_STATUSES.map(stat => (
                    <option key={stat} value={stat}>{stat.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description & Justification */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-[10px] text-[var(--text-secondary)] font-mono uppercase mb-1.5">Scope Description</label>
                <textarea
                  rows={2}
                  placeholder="Detailed breakdown of the revised work scope..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[var(--text-secondary)] font-mono uppercase mb-1.5">Justification</label>
                <textarea
                  rows={2}
                  placeholder="Technical justification or explanation for why the change is required..."
                  value={justification}
                  onChange={e => setJustification(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-2 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            {/* Line Items Editor */}
            <div className="flex flex-col gap-3 mt-4">
              <div className="flex justify-between items-center border-b border-[var(--border)] pb-2">
                <span className="text-[10px] text-[var(--text-secondary)] font-mono uppercase">Variation Line Items (ex-VAT)</span>
                <button
                  type="button"
                  onClick={addItemRow}
                  className="px-2.5 py-1 bg-[var(--surface-hover)] border border-[var(--border)] text-[10px] text-[var(--accent)] font-mono rounded hover:bg-[var(--surface-hover)] uppercase"
                >
                  + Add Item Line
                </button>
              </div>

              {items.map((item, idx) => (
                <div key={idx} className="bg-[var(--bg-card)]/30 border border-[var(--border)] p-4 rounded flex flex-col gap-3">
                  
                  {/* Row 1: Action, Ref, Description */}
                  <div className="flex flex-col md:flex-row gap-3 items-center">
                    <div className="w-full md:w-32">
                      <select
                        value={item.action}
                        onChange={e => handleActionChange(idx, e.target.value as any)}
                        className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-1.5 px-2 text-xs font-mono font-bold text-[var(--text-secondary)] focus:outline-none"
                      >
                        <option value="ADD">ADD</option>
                        <option value="OMIT">OMIT</option>
                        <option value="RE_RATE">RE-RATE</option>
                      </select>
                    </div>

                    <div className="flex-1 w-full relative">
                      <input
                        type="text"
                        placeholder="Description of item..."
                        value={item.description}
                        onChange={e => handleItemChange(idx, 'description', e.target.value)}
                        className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-1.5 px-3 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
                        required
                      />
                      {item.boq_item_ref && (
                        <div className="absolute right-2.5 top-2.5 text-[8px] text-[var(--accent)] font-mono uppercase border border-[var(--accent)] px-1 rounded bg-[#060a1e]">
                          BOQ: {item.boq_item_ref.toString().substring(0, 12)}
                        </div>
                      )}
                    </div>

                    {/* Button to re-open picker if applicable */}
                    {(item.action === 'OMIT' || item.action === 'RE_RATE') && (
                      <button
                        type="button"
                        onClick={() => {
                          setPickerTargetIndex(idx);
                          setPickerOpen(true);
                        }}
                        className="px-2 py-1.5 bg-[var(--surface-hover)] border border-[var(--border)] text-[10px] text-[var(--text-secondary)] font-mono rounded hover:bg-[var(--surface-hover)] flex items-center gap-1 shrink-0"
                        title="Pick BOQ item"
                      >
                        <FolderOpen size={12} /> Select BOQ Item
                      </button>
                    )}
                  </div>

                  {/* Row 2: Qty, Unit, Cost, Sell, System, Notes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 items-center">
                    
                    <div>
                      <label className="block text-[8px] text-[var(--text-primary)]0 font-mono uppercase mb-0.5">Qty</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="Qty"
                        value={item.quantity || ''}
                        onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))}
                        className={`w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-1 px-2.5 text-xs focus:outline-none font-mono text-right ${
                          item.quantity < 0 ? 'text-[var(--status-danger-text)] font-bold' : 'text-[var(--text-secondary)]'
                        }`}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[8px] text-[var(--text-primary)]0 font-mono uppercase mb-0.5">Unit</label>
                      <input
                        type="text"
                        placeholder="Unit"
                        value={item.unit}
                        onChange={e => handleItemChange(idx, 'unit', e.target.value)}
                        className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-1 px-2 text-xs text-[var(--text-secondary)] focus:outline-none font-mono text-center"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[8px] text-[var(--text-primary)]0 font-mono uppercase mb-0.5">Unit Cost (AED)</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="Cost"
                        value={item.unit_cost || ''}
                        onChange={e => handleItemChange(idx, 'unit_cost', Number(e.target.value))}
                        className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-1 px-2 text-xs text-[var(--text-secondary)] focus:outline-none font-mono text-right"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[8px] text-[var(--text-primary)]0 font-mono uppercase mb-0.5">Unit Sell (AED)</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="Sell"
                        value={item.unit_sell || ''}
                        onChange={e => handleItemChange(idx, 'unit_sell', Number(e.target.value))}
                        className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-1 px-2 text-xs text-[var(--text-secondary)] focus:outline-none font-mono text-right"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[8px] text-[var(--text-primary)]0 font-mono uppercase mb-0.5">Associated System</label>
                      <select
                        value={item.system}
                        onChange={e => handleItemChange(idx, 'system', e.target.value)}
                        className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-1 px-1.5 text-xs text-[var(--text-secondary)] focus:outline-none"
                      >
                        <option value="CCTV">CCTV</option>
                        <option value="ACCESS_CONTROL">Access Control</option>
                        <option value="FIRE_ALARM">Fire Alarm</option>
                        <option value="BMS">BMS</option>
                        <option value="STRUCTURED_CABLING">Structured Cabling</option>
                        <option value="PA_AV_BGM">PA / AV / BGM</option>
                        <option value="GATE_BARRIER">Gate Barrier</option>
                        <option value="KNX_SMART_HOME">Smart Home</option>
                        <option value="ELECTRICAL">Electrical</option>
                        <option value="OTHER">Other / Misc</option>
                      </select>
                    </div>

                    <div className="text-right flex items-center justify-between pl-2 self-end">
                      <div className="flex flex-col text-right pr-2">
                        <span className="text-[8px] text-[var(--text-primary)]0 font-mono uppercase">Line Total</span>
                        <span className={`font-mono text-xs font-bold ${item.quantity * item.unit_sell < 0 ? 'text-[var(--status-danger-text)]' : 'text-[var(--text-primary)]'}`}>
                          {(item.quantity * item.unit_sell).toFixed(2)} AED
                        </span>
                      </div>
                      
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          className="p-1 text-[var(--text-tertiary)] hover:text-[var(--status-danger-text)] transition-colors"
                          title="Delete line"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar calculations & margins */}
          <div className="w-full lg:w-80 bg-[var(--bg-card)] border border-[var(--border)] rounded p-6 flex flex-col gap-5 h-fit">
            <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider border-b border-[var(--border)] pb-2">
              Financial Summary (ex-VAT)
            </h3>

            <div className="flex flex-col gap-3.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Total VO Cost:</span>
                <span className="font-mono text-[var(--text-primary)]">{subtotalCost.toFixed(2)} AED</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Total VO Sell:</span>
                <span className="font-mono text-[var(--text-primary)]">{subtotalSell.toFixed(2)} AED</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Estimated Margin:</span>
                <span className={`font-mono font-bold ${marginPct < 20 ? 'text-[var(--status-danger-text)]' : 'text-[var(--accent)]'}`}>
                  {marginAmount.toFixed(2)} AED ({marginPct.toFixed(1)}%)
                </span>
              </div>
              
              <div className="flex justify-between border-t border-[var(--border)] pt-3">
                <span className="text-[var(--text-secondary)] font-semibold">VAT (5.00%):</span>
                <span className="font-mono text-[var(--text-secondary)]">{vat.toFixed(2)} AED</span>
              </div>

              <div className="flex justify-between bg-[var(--bg-card)] p-3 rounded border border-[var(--border)] mt-2">
                <span className="font-bold text-[var(--text-primary)]">Total Value:</span>
                <span className="font-mono font-bold text-[var(--accent)] text-sm">
                  {totalInclVat.toFixed(2)} AED
                </span>
              </div>
            </div>

            {/* Warnings */}
            {marginPct < 20 && subtotalSell > 0 && (
              <div className="bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] text-[var(--status-warning-text)] text-[10px] p-2.5 rounded font-sans leading-normal">
                <div className="font-bold flex items-center gap-1 mb-0.5"><AlertTriangle size={11} /> Margin Below 20%</div>
                This Variation margin ratio is lower than company cost standards (20%). Internal approvals may request revision or justification.
              </div>
            )}

            {workStatus !== 'NOT_STARTED' && (
              <div className="bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] text-[10px] p-2.5 rounded font-sans leading-normal">
                <div className="font-bold flex items-center gap-1 mb-0.5"><ShieldAlert size={11} className="animate-pulse" /> At-Risk Operation</div>
                Work has already started on site prior to client signature. This VO will register as a "Proceed At-Risk" exposure.
              </div>
            )}

            <button
              type="submit"
              disabled={loading || items.length === 0}
              className="w-full py-2.5 bg-[var(--accent)] text-white font-bold rounded hover:bg-[var(--accent)] transition-all uppercase tracking-wider text-xs shadow-[0_0_15px_var(--accent-glow)] disabled:opacity-40"
            >
              {loading ? 'Saving Draft...' : 'Save VO Draft'}
            </button>
          </div>
        </form>
      </main>

      {/* BOQ Item Picker Drawer / Modal */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded max-w-2xl w-full flex flex-col max-h-[80vh]">
            
            {/* Modal Header */}
            <div className="bg-[var(--bg-card)] p-4 border-b border-[var(--border)] flex justify-between items-center">
              <h4 className="text-xs font-mono text-[var(--accent)] uppercase tracking-widest font-bold">
                Project BOQ Item Picker
              </h4>
              <button
                type="button"
                onClick={() => { setPickerOpen(false); setPickerTargetIndex(null); }}
                className="text-[var(--text-primary)]0 hover:text-[var(--text-secondary)] font-mono text-xs uppercase"
              >
                Close
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-[var(--border)] relative">
              <span className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-[var(--text-primary)]0">
                <Search size={12} />
              </span>
              <input
                type="text"
                placeholder="Search by BOQ item description or system..."
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
                className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded py-1.5 pl-8 pr-3 text-xs text-[var(--text-secondary)] focus:outline-none font-mono"
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 font-mono text-xs">
              {filteredBOQItems.length === 0 ? (
                <div className="text-[var(--text-primary)]0 text-center py-8">
                  {projectId ? 'No items found matching the search.' : 'Please select a Project first to load BOQ lines.'}
                </div>
              ) : (
                filteredBOQItems.map((bi, i) => (
                  <div
                    key={bi.id || i}
                    onClick={() => selectBOQItem(bi)}
                    className="p-3 bg-[var(--bg-card)]/40 border border-[var(--border)] rounded hover:border-[var(--accent)] hover:bg-[var(--surface-hover)] transition-all cursor-pointer flex justify-between items-center"
                  >
                    <div className="flex-1 pr-4">
                      <div className="font-semibold text-[var(--text-primary)]">{bi.name}</div>
                      <div className="text-[10px] text-[var(--text-primary)]0 flex gap-2.5 mt-1">
                        <span>System: <strong className="text-[var(--text-secondary)]">{bi.system || 'OTHER'}</strong></span>
                        <span>Original Qty: <strong className="text-[var(--text-secondary)]">{bi.quantity} {bi.unit}</strong></span>
                        <span>Rate: <strong className="text-[var(--text-secondary)]">{(bi.unit_price || bi.unit_sell || bi.material_unit_cost || 0).toFixed(2)} AED</strong></span>
                      </div>
                    </div>
                    <span className="text-[10px] text-[var(--accent)] font-bold uppercase hover:underline">Select</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function VOCreatePage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text-primary)] flex items-center justify-center font-mono text-xs text-[var(--accent)]">Loading...</div>}>
      <VOCreatePageContent />
    </React.Suspense>
  );
}
