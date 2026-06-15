'use client';

import React, { useState, useEffect, useCallback, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  FileText,
  FileSpreadsheet,
  Check,
  Lock,
  Send,
  AlertCircle,
  Clock,
  Shield,
  Calculator,
  TrendingUp,
  Layers,
  GitBranch,
  CheckCircle,
  XCircle,
  Award,
  ChevronDown,
  Calendar,
  User,
  Settings,
  Mail,
  FileSignature
} from 'lucide-react';
import {
  type BOQItem,
  type CostElements,
  type Financials,
  type BOQStatus,
  BOQ_STATUSES,
  BOQ_STATUS_LABELS,
  createEmptyItem,
  createDefaultCostElements,
  createDefaultFinancials,
  recalculateAll,
  calculateItemFinancials,
  formatCurrency,
  canRoleApprove,
  getNextApprovalStatus,
} from '@/lib/boq-calculations';
import { exportBOQToPDF, exportBOQToExcel } from '@/lib/boq-export';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';
import './boq.css';


// --- Types ---
type ApprovalEntry = {
  stage: string;
  approved_by: string;
  email: string;
  approved_at: string;
  note: string;
};

type VersionEntry = {
  id: string;
  version: number;
  created_by: string;
  created_at: string;
};

type TenderInfo = {
  id: string;
  title: string;
  project_name: string;
  client_name: string;
  location: string;
  status: string;
};

type Profile = {
  role: string;
  full_name: string;
  email: string;
};

const fmtNum = (v: number) =>
  new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

export default function BOQDashboard({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const tenderId = resolvedParams.id;

  // Core states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tender, setTender] = useState<TenderInfo | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // BOQ data
  const [boqId, setBoqId] = useState<string | null>(null);
  const [boqStatus, setBoqStatus] = useState<BOQStatus>('draft');
  const [boqVersion, setBoqVersion] = useState(1);
  const [items, setItems] = useState<BOQItem[]>([createEmptyItem()]);
  const [costElements, setCostElements] = useState<CostElements>(createDefaultCostElements());
  const [financials, setFinancials] = useState<Financials>(createDefaultFinancials());
  
  // Selection and Bulk Actions State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkQty, setBulkQty] = useState<number | ''>('');

  // Table Column Width States for Resize
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    num: 35,
    checkbox: 40,
    actions: 75,
    item_code: 90,
    name: 240,
    unit: 65,
    quantity: 65,
    override: 95,
    supply_unit: 100,
    net_purchase: 100,
    supply_total: 110,
    tech_hours: 65,
    tech_count: 55,
    tech_rate: 70,
    tech_cost: 95,
    eng_hours: 65,
    eng_count: 55,
    eng_rate: 70,
    eng_cost: 95,
    pm_hours: 65,
    pm_count: 55,
    pm_rate: 70,
    pm_cost: 95,
    gross_labour: 110,
    subcontract: 100,
    equipment: 100,
    logistics: 100,
    wastage_pct: 65,
    wastage_cost: 100,
    risk_pct: 65,
    risk_cost: 100,
    site_overhead_pct: 65,
    site_overhead_cost: 100,
    total_cost: 110,
    profit_pct: 65,
    profit_cost: 100,
    unit_selling: 110,
    total_selling: 120,
  });

  const [approvalHistory, setApprovalHistory] = useState<ApprovalEntry[]>([]);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [approvalNote, setApprovalNote] = useState('');
  const [activeQuotation, setActiveQuotation] = useState<any>(null);

  // UI states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [boqExists, setBoqExists] = useState(false);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<'code' | 'name'>('name');

  // Simple view hides the detailed cost-buildup groups (labour, subcontract,
  // equipment, logistics, wastage, risk, overhead) leaving a clean pricing
  // sheet; Detailed view shows all 38 columns. Persisted per user.
  const [compactView, setCompactView] = useState(true);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('boq-compact-view');
      if (saved !== null) setCompactView(saved === '1');
    } catch { /* ignore */ }
  }, []);
  const toggleCompactView = () => {
    setCompactView(prev => {
      try { localStorage.setItem('boq-compact-view', prev ? '0' : '1'); } catch { /* ignore */ }
      return !prev;
    });
  };
  const [searchQuery, setSearchQuery] = useState('');

  // Applies a Master Rate Catalogue selection to a grid row: every costing
  // field (supply cost, labour hours/counts/rates, wastage/risk/overhead/
  // profit) is imported and the row is recalculated immediately.
  const applyCatalogSelection = (rowId: string, selectedItem: any) => {
    setItems(prevItems => prevItems.map(i => {
      if (i.id !== rowId) return i;
      const updated = {
        ...i,
        item_code: selectedItem.item_code,
        name: selectedItem.description,
        unit: selectedItem.unit || 'Pcs',
        material_unit_cost: selectedItem.material_cost,
        net_purchase_cost_per_unit: selectedItem.material_cost,
        labor_technician_hours: selectedItem.labour_technician_hours || 0,
        labor_engineer_hours: selectedItem.labour_engineer_hours || 0,
        labor_pm_hours: selectedItem.labour_pm_hours || 0,
        labor_technician_count: selectedItem.labour_technician_count || 1,
        labor_engineer_count: selectedItem.labour_engineer_count || 0,
        labor_pm_count: selectedItem.labour_pm_count || 0,
        labor_technician_rate: selectedItem.labour_technician_rate ?? costElements.technician_rate,
        labor_engineer_rate: selectedItem.labour_engineer_rate ?? costElements.engineer_rate,
        labor_pm_rate: selectedItem.labour_pm_rate ?? costElements.pm_rate,
        wastage_pct: selectedItem.wastage_pct ?? costElements.wastage_pct,
        risk_pct: selectedItem.risk_pct ?? costElements.risk_pct,
        site_overhead_pct: selectedItem.overhead_pct ?? costElements.site_overhead_pct,
        profit_pct: selectedItem.markup_pct ?? costElements.profit_pct,
      };
      return calculateItemFinancials(updated, {
        wastage_pct: costElements.wastage_pct,
        risk_pct: costElements.risk_pct,
        site_overhead_pct: costElements.site_overhead_pct,
        profit_pct: costElements.profit_pct,
        technician_rate: costElements.technician_rate,
        engineer_rate: costElements.engineer_rate,
        pm_rate: costElements.pm_rate,
      });
    }));
    setFocusedItemId(null);
  };

  const isEditable = boqStatus === 'draft';

  // --- Recalculate on any input change ---
  const doRecalculate = useCallback(() => {
    const result = recalculateAll(items, costElements, costElements.profit_pct, 1);
    setFinancials(result);
  }, [items, costElements]);

  useEffect(() => {
    doRecalculate();
  }, [doRecalculate]);

  // --- Load data ---
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        // 1. Auth check
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
          router.replace('/signin');
          return;
        }

        // 2. Get profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('role, full_name, email')
          .eq('id', user.id)
          .single();

        if (profileData) {
          setProfile(profileData as Profile);
        } else {
          setProfile({
            role: user.user_metadata?.role || 'engineer',
            full_name: user.user_metadata?.full_name || 'ERP User',
            email: user.email || '',
          });
        }

        // 3. Get tender info
        const { data: tenderData, error: tenderErr } = await supabase
          .from('tenders')
          .select('id, title, project_name, client_name, location, status')
          .eq('id', tenderId)
          .single();

        if (tenderErr) throw tenderErr;
        setTender(tenderData as TenderInfo);

        // Check if tender is approved
        if (tenderData.status !== 'Approved' && tenderData.status !== 'Completed') {
          setErrorMsg('Tender must be approved before accessing BOQ.');
          setLoading(false);
          return;
        }

        // 4. Get BOQ
        const { data: boqData } = await supabase
          .from('boqs')
          .select('*')
          .eq('tender_id', tenderId)
          .maybeSingle();

        if (boqData) {
          setBoqExists(true);
          setBoqId(boqData.id);
          setBoqStatus(boqData.status as BOQStatus);
          setBoqVersion(boqData.version);
          setApprovalHistory((boqData.approval_history as ApprovalEntry[]) || []);

          // Load global cost settings
          const savedCost = boqData.cost_elements as CostElements;
          const defaultCosts = createDefaultCostElements();
          let loadedCostElements = defaultCosts;
          if (savedCost && Object.keys(savedCost).length > 0) {
            loadedCostElements = {
              ...defaultCosts,
              ...savedCost,
              risk_pct: savedCost.risk_pct ?? defaultCosts.risk_pct,
              site_overhead_pct: savedCost.site_overhead_pct ?? defaultCosts.site_overhead_pct,
              technician_rate: savedCost.technician_rate ?? defaultCosts.technician_rate,
              engineer_rate: savedCost.engineer_rate ?? defaultCosts.engineer_rate,
              pm_rate: savedCost.pm_rate ?? defaultCosts.pm_rate,
              wastage_pct: savedCost.wastage_pct ?? defaultCosts.wastage_pct,
              profit_pct: savedCost.profit_pct ?? (boqData.financials?.profit_pct ?? defaultCosts.profit_pct),
            };
            setCostElements(loadedCostElements);
          }

          const savedItems = boqData.items as BOQItem[];
          if (savedItems && savedItems.length > 0) {
            // Apply recalculations with stored globals
            setItems(savedItems.map(item => calculateItemFinancials(item, {
              wastage_pct: loadedCostElements.wastage_pct,
              risk_pct: loadedCostElements.risk_pct,
              site_overhead_pct: loadedCostElements.site_overhead_pct,
              profit_pct: loadedCostElements.profit_pct,
              technician_rate: loadedCostElements.technician_rate,
              engineer_rate: loadedCostElements.engineer_rate,
              pm_rate: loadedCostElements.pm_rate,
            })));
          }

          // 5. Get versions
          const { data: versionData } = await supabase
            .from('boq_versions')
            .select('id, version, created_by, created_at')
            .eq('boq_id', boqData.id)
            .order('version', { ascending: false });

          if (versionData) {
            setVersions(versionData as VersionEntry[]);
          }

          // Check for linked active quotation
          const { data: quoteData } = await supabase
            .from('quotations')
            .select('id, quotation_number, status')
            .eq('boq_id', boqData.id)
            .in('status', ['DRAFT', 'PENDING_COMMERCIAL', 'PENDING_GM', 'APPROVED', 'SENT_TO_CLIENT', 'ACCEPTED'])
            .maybeSingle();

          if (quoteData) {
            setActiveQuotation(quoteData);
          }

        } else {
          // Initialize empty BOQ with defaults
          const defaultCosts = createDefaultCostElements();
          setCostElements(defaultCosts);
          setItems([createEmptyItem({
            wastage_pct: defaultCosts.wastage_pct,
            risk_pct: defaultCosts.risk_pct,
            site_overhead_pct: defaultCosts.site_overhead_pct,
            profit_pct: defaultCosts.profit_pct,
            technician_rate: defaultCosts.technician_rate,
            engineer_rate: defaultCosts.engineer_rate,
            pm_rate: defaultCosts.pm_rate,
          })]);
        }

        // 6. Get catalog items for suggestions
        const { data: catalogData } = await supabase
          .from('pricing_items')
          .select('*')
          .eq('is_active', true);
        if (catalogData) {
          setCatalog(catalogData);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load BOQ data.';
        console.error('BOQ load error:', err);
        setErrorMsg(message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [tenderId, router]);

  // --- Create BOQ ---
  const handleCreateBOQ = async () => {
    setSaving(true);
    setErrorMsg(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const defaultCosts = createDefaultCostElements();

      const { data, error } = await supabase
        .from('boqs')
        .insert({
          tender_id: tenderId,
          created_by: user.id,
          status: 'draft',
          version: 1,
          items: [createEmptyItem({
            wastage_pct: defaultCosts.wastage_pct,
            risk_pct: defaultCosts.risk_pct,
            site_overhead_pct: defaultCosts.site_overhead_pct,
            profit_pct: defaultCosts.profit_pct,
            technician_rate: defaultCosts.technician_rate,
            engineer_rate: defaultCosts.engineer_rate,
            pm_rate: defaultCosts.pm_rate,
          })],
          cost_elements: defaultCosts,
          financials: createDefaultFinancials(),
          approval_history: [],
        })
        .select()
        .single();

      if (error) throw error;

      setBoqExists(true);
      setBoqId(data.id);
      setBoqStatus('draft');
      setBoqVersion(1);
      setCostElements(defaultCosts);
      setItems([createEmptyItem({
        wastage_pct: defaultCosts.wastage_pct,
        risk_pct: defaultCosts.risk_pct,
        site_overhead_pct: defaultCosts.site_overhead_pct,
        profit_pct: defaultCosts.profit_pct,
        technician_rate: defaultCosts.technician_rate,
        engineer_rate: defaultCosts.engineer_rate,
        pm_rate: defaultCosts.pm_rate,
      })]);
      setSuccessMsg('BOQ workspace created successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create BOQ.';
      setErrorMsg(message);
    } finally {
      setSaving(false);
    }
  };

  // --- Save BOQ ---
  const handleSave = async () => {
    if (!boqId || !isEditable) return;
    setSaving(true);
    setErrorMsg(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: updateErr } = await supabase
        .from('boqs')
        .update({
          items,
          cost_elements: costElements,
          financials,
          updated_at: new Date().toISOString(),
        })
        .eq('id', boqId);

      if (updateErr) throw updateErr;

      setSuccessMsg('BOQ estimations saved successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save BOQ.';
      setErrorMsg(message);
    } finally {
      setSaving(false);
    }
  };

  // --- Submit for Review ---
  const handleSubmit = async () => {
    if (!boqId || boqStatus !== 'draft') return;

    const hasValidItems = items.some(i => i.name.trim() && i.quantity > 0 && i.total_price > 0);
    if (!hasValidItems) {
      setErrorMsg('Please add at least one valid item before submitting.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create version snapshot at the time of submission
      await supabase.from('boq_versions').insert({
        boq_id: boqId,
        version: boqVersion,
        items,
        cost_elements: costElements,
        financials,
        created_by: user.id,
      });

      const { error } = await supabase
        .from('boqs')
        .update({
          status: 'submitted',
          items,
          cost_elements: costElements,
          financials,
          updated_at: new Date().toISOString(),
        })
        .eq('id', boqId);

      if (error) throw error;

      setBoqStatus('submitted');
      setSuccessMsg('BOQ submitted for review!');
      setTimeout(() => setSuccessMsg(null), 3000);

      // Reload versions history list
      const { data: versionData } = await supabase
        .from('boq_versions')
        .select('id, version, created_by, created_at')
        .eq('boq_id', boqId)
        .order('version', { ascending: false });

      if (versionData) setVersions(versionData as VersionEntry[]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Submit failed.';
      setErrorMsg(message);
    } finally {
      setSaving(false);
    }
  };

  // --- Create Revision ---
  const handleCreateRevision = async () => {
    if (!boqId) return;
    setSaving(true);
    setErrorMsg(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Create a version snapshot of the locked/finalized version
      const { error: versionErr } = await supabase
        .from('boq_versions')
        .insert({
          boq_id: boqId,
          version: boqVersion,
          items,
          cost_elements: costElements,
          financials,
          created_by: user.id,
        });

      if (versionErr) {
        console.warn('Snapshot warning:', versionErr);
      }

      // 2. Increment the version and set the status back to Draft
      const nextVersion = boqVersion + 1;
      const { error: updateErr } = await supabase
        .from('boqs')
        .update({
          status: 'draft',
          version: nextVersion,
          updated_at: new Date().toISOString(),
        })
        .eq('id', boqId);

      if (updateErr) throw updateErr;

      setBoqStatus('draft');
      setBoqVersion(nextVersion);
      setSuccessMsg(`Created revision v${nextVersion} (returned to Draft)`);
      setTimeout(() => setSuccessMsg(null), 3000);

      // Reload version history list
      const { data: versionData } = await supabase
        .from('boq_versions')
        .select('id, version, created_by, created_at')
        .eq('boq_id', boqId)
        .order('version', { ascending: false });

      if (versionData) setVersions(versionData as VersionEntry[]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Revision failed.';
      setErrorMsg(message);
    } finally {
      setSaving(false);
    }
  };

  // --- Approve ---
  const handleApprove = async () => {
    if (!boqId || !profile) return;
    setSaving(true);
    setErrorMsg(null);

    try {
      const nextStatus = getNextApprovalStatus(profile.role, boqStatus);
      if (!nextStatus) {
        setErrorMsg('You are not authorized to approve at this stage.');
        setSaving(false);
        return;
      }

      const newEntry: ApprovalEntry = {
        stage: BOQ_STATUS_LABELS[nextStatus],
        approved_by: profile.full_name,
        email: profile.email,
        approved_at: new Date().toISOString(),
        note: approvalNote.trim() || `Approved by ${profile.role}`,
      };

      const updatedHistory = [newEntry, ...approvalHistory];

      const { error } = await supabase
        .from('boqs')
        .update({
          status: nextStatus,
          approval_history: updatedHistory,
          updated_at: new Date().toISOString(),
        })
        .eq('id', boqId);

      if (error) throw error;

      setBoqStatus(nextStatus);
      setApprovalHistory(updatedHistory);
      setApprovalNote('');
      setSuccessMsg(`BOQ approved → ${BOQ_STATUS_LABELS[nextStatus]}`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Approval failed.';
      setErrorMsg(message);
    } finally {
      setSaving(false);
    }
  };

  // --- Reject ---
  const handleReject = async () => {
    if (!boqId || !profile) return;
    setSaving(true);

    try {
      const newEntry: ApprovalEntry = {
        stage: 'Rejected',
        approved_by: profile.full_name,
        email: profile.email,
        approved_at: new Date().toISOString(),
        note: approvalNote.trim() || `Rejected by ${profile.role} — returned to draft`,
      };

      const { error } = await supabase
        .from('boqs')
        .update({
          status: 'draft',
          approval_history: [newEntry, ...approvalHistory],
          updated_at: new Date().toISOString(),
        })
        .eq('id', boqId);

      if (error) throw error;

      setBoqStatus('draft');
      setApprovalHistory([newEntry, ...approvalHistory]);
      setApprovalNote('');
      setSuccessMsg('BOQ rejected and returned to draft.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Rejection failed.';
      setErrorMsg(message);
    } finally {
      setSaving(false);
    }
  };

  // --- Finalize ---
  const handleFinalize = async () => {
    if (!boqId || boqStatus !== 'finance_approved') return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('boqs')
        .update({ status: 'finalized', updated_at: new Date().toISOString() })
        .eq('id', boqId);

      if (error) throw error;

      setBoqStatus('finalized');
      setSuccessMsg('BOQ finalized! Now read-only.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Finalize failed.';
      setErrorMsg(message);
    } finally {
      setSaving(false);
    }
  };

  // --- Export Handlers ---
  const handleExportPDF = () => {
    if (!tender || !boqId) return;
    exportBOQToPDF(
      tender,
      { id: boqId, status: boqStatus, version: boqVersion, created_at: '' },
      items,
      costElements,
      financials,
      approvalHistory
    );

    if (boqStatus === 'finalized') {
      supabase.from('boqs').update({ status: 'exported', updated_at: new Date().toISOString() }).eq('id', boqId).then(() => {
        setBoqStatus('exported');
      });
    }
  };

  const handleExportExcel = () => {
    if (!tender || !boqId) return;
    exportBOQToExcel(
      tender,
      { id: boqId, status: boqStatus, version: boqVersion, created_at: '' },
      items,
      costElements,
      financials
    );
  };

  // --- Item Handlers ---
  const addItem = () => {
    setItems([
      ...items,
      createEmptyItem({
        wastage_pct: costElements.wastage_pct,
        risk_pct: costElements.risk_pct,
        site_overhead_pct: costElements.site_overhead_pct,
        profit_pct: costElements.profit_pct,
        technician_rate: costElements.technician_rate,
        engineer_rate: costElements.engineer_rate,
        pm_rate: costElements.pm_rate,
      }),
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(items.filter(i => i.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const duplicateItem = (id: string) => {
    const index = items.findIndex(i => i.id === id);
    if (index === -1) return;
    const source = items[index];
    const duplicated: BOQItem = {
      ...source,
      id: Math.random().toString(36).substring(2),
      item_code: source.item_code ? `${source.item_code}_copy` : '',
    };
    const nextItems = [...items];
    nextItems.splice(index + 1, 0, duplicated);
    setItems(nextItems);
  };

  const updateItem = (id: string, field: keyof BOQItem, value: any) => {
    setItems(prevItems =>
      prevItems.map(i => {
        if (i.id !== id) return i;
        const updated = { ...i, [field]: value };
        
        // If Unit Supply Cost is changed, default Net purchase cost per unit to it
        if (field === 'material_unit_cost') {
          updated.net_purchase_cost_per_unit = value;
        }

        // Apply recalculation using current global defaults
        return calculateItemFinancials(updated, {
          wastage_pct: costElements.wastage_pct,
          risk_pct: costElements.risk_pct,
          site_overhead_pct: costElements.site_overhead_pct,
          profit_pct: costElements.profit_pct,
          technician_rate: costElements.technician_rate,
          engineer_rate: costElements.engineer_rate,
          pm_rate: costElements.pm_rate,
        });
      })
    );
  };

  // Global cost settings adjustments
  const updateGlobalSetting = (field: keyof CostElements, value: number) => {
    const updatedCostElements = { ...costElements, [field]: value };
    setCostElements(updatedCostElements);

    // Apply immediately to items that don't have overrides enabled
    setItems(prevItems =>
      prevItems.map(item => {
        return calculateItemFinancials(item, {
          wastage_pct: updatedCostElements.wastage_pct,
          risk_pct: updatedCostElements.risk_pct,
          site_overhead_pct: updatedCostElements.site_overhead_pct,
          profit_pct: updatedCostElements.profit_pct,
          technician_rate: updatedCostElements.technician_rate,
          engineer_rate: updatedCostElements.engineer_rate,
          pm_rate: updatedCostElements.pm_rate,
        });
      })
    );
  };

  // --- Apply Globals Buttons ---
  const applyGlobalsToAll = () => {
    setItems(prevItems =>
      prevItems.map(item => {
        const resetItem = { ...item, override_settings: false };
        return calculateItemFinancials(resetItem, {
          wastage_pct: costElements.wastage_pct,
          risk_pct: costElements.risk_pct,
          site_overhead_pct: costElements.site_overhead_pct,
          profit_pct: costElements.profit_pct,
          technician_rate: costElements.technician_rate,
          engineer_rate: costElements.engineer_rate,
          pm_rate: costElements.pm_rate,
        });
      })
    );
    setSuccessMsg('Applied global costing templates to all lines.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const applyGlobalsToSelected = () => {
    if (selectedIds.size === 0) {
      setErrorMsg('No items selected. Select items using the checkboxes first.');
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }
    setItems(prevItems =>
      prevItems.map(item => {
        if (!selectedIds.has(item.id)) return item;
        const resetItem = { ...item, override_settings: false };
        return calculateItemFinancials(resetItem, {
          wastage_pct: costElements.wastage_pct,
          risk_pct: costElements.risk_pct,
          site_overhead_pct: costElements.site_overhead_pct,
          profit_pct: costElements.profit_pct,
          technician_rate: costElements.technician_rate,
          engineer_rate: costElements.engineer_rate,
          pm_rate: costElements.pm_rate,
        });
      })
    );
    setSuccessMsg(`Applied global costing templates to ${selectedIds.size} selected lines.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // --- Row Override Checkbox Helper ---
  const toggleOverride = (id: string, enabled: boolean) => {
    setItems(prevItems =>
      prevItems.map(item => {
        if (item.id !== id) return item;
        
        const updated = { ...item, override_settings: enabled };
        
        // When enabling overrides, copy the current globals into local fields as the editing baseline
        if (enabled) {
          updated.wastage_pct = item.wastage_pct ?? costElements.wastage_pct;
          updated.risk_pct = item.risk_pct ?? costElements.risk_pct;
          updated.site_overhead_pct = item.site_overhead_pct ?? costElements.site_overhead_pct;
          updated.profit_pct = item.profit_pct ?? costElements.profit_pct;
          updated.labor_technician_rate = item.labor_technician_rate ?? costElements.technician_rate;
          updated.labor_engineer_rate = item.labor_engineer_rate ?? costElements.engineer_rate;
          updated.labor_pm_rate = item.labor_pm_rate ?? costElements.pm_rate;
        }

        return calculateItemFinancials(updated, {
          wastage_pct: costElements.wastage_pct,
          risk_pct: costElements.risk_pct,
          site_overhead_pct: costElements.site_overhead_pct,
          profit_pct: costElements.profit_pct,
          technician_rate: costElements.technician_rate,
          engineer_rate: costElements.engineer_rate,
          pm_rate: costElements.pm_rate,
        });
      })
    );
  };

  // --- Bulk Selection Actions ---
  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(items.map(i => i.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelectRow = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (items.length - selectedIds.size < 1) {
      setErrorMsg('Cannot delete all rows. At least one line item is required.');
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }
    setItems(items.filter(i => !selectedIds.has(i.id)));
    setSelectedIds(new Set());
    setSuccessMsg('Deleted selected rows.');
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const handleBulkDuplicate = () => {
    if (selectedIds.size === 0) return;
    const duplicatedItems: BOQItem[] = [];
    items.forEach(item => {
      duplicatedItems.push(item);
      if (selectedIds.has(item.id)) {
        duplicatedItems.push({
          ...item,
          id: Math.random().toString(36).substring(2),
          item_code: item.item_code ? `${item.item_code}_copy` : '',
        });
      }
    });
    setItems(duplicatedItems);
    setSuccessMsg('Duplicated selected rows.');
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const handleBulkOverride = (enable: boolean) => {
    if (selectedIds.size === 0) return;
    setItems(prevItems =>
      prevItems.map(item => {
        if (!selectedIds.has(item.id)) return item;
        const updated = { ...item, override_settings: enable };
        if (enable) {
          updated.wastage_pct = item.wastage_pct ?? costElements.wastage_pct;
          updated.risk_pct = item.risk_pct ?? costElements.risk_pct;
          updated.site_overhead_pct = item.site_overhead_pct ?? costElements.site_overhead_pct;
          updated.profit_pct = item.profit_pct ?? costElements.profit_pct;
          updated.labor_technician_rate = item.labor_technician_rate ?? costElements.technician_rate;
          updated.labor_engineer_rate = item.labor_engineer_rate ?? costElements.engineer_rate;
          updated.labor_pm_rate = item.labor_pm_rate ?? costElements.pm_rate;
        }
        return calculateItemFinancials(updated, {
          wastage_pct: costElements.wastage_pct,
          risk_pct: costElements.risk_pct,
          site_overhead_pct: costElements.site_overhead_pct,
          profit_pct: costElements.profit_pct,
          technician_rate: costElements.technician_rate,
          engineer_rate: costElements.engineer_rate,
          pm_rate: costElements.pm_rate,
        });
      })
    );
    setSuccessMsg(`${enable ? 'Enabled' : 'Disabled'} overrides for selected rows.`);
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const handleBulkUpdateQty = () => {
    if (selectedIds.size === 0 || bulkQty === '') return;
    setItems(prevItems =>
      prevItems.map(item => {
        if (!selectedIds.has(item.id)) return item;
        const updated = { ...item, quantity: Number(bulkQty) };
        return calculateItemFinancials(updated, {
          wastage_pct: costElements.wastage_pct,
          risk_pct: costElements.risk_pct,
          site_overhead_pct: costElements.site_overhead_pct,
          profit_pct: costElements.profit_pct,
          technician_rate: costElements.technician_rate,
          engineer_rate: costElements.engineer_rate,
          pm_rate: costElements.pm_rate,
        });
      })
    );
    setBulkQty('');
    setSuccessMsg('Bulk updated quantities.');
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  // --- Column Resize Drag Action ---
  // Excel-style keyboard navigation: Enter/↓ moves to the same column in the
  // next row, ↑ moves up; Enter on the last row appends a new line.
  const handleGridKeyDown = useCallback((e: React.KeyboardEvent) => {
    const input = e.target as HTMLInputElement;
    if (input.tagName !== 'INPUT' || input.type === 'checkbox') return;
    if (!['Enter', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;

    const cell = input.closest('td') as HTMLTableCellElement | null;
    const row = input.closest('tr');
    if (!cell || !row) return;

    const goUp = e.key === 'ArrowUp';
    const targetRow = (goUp ? row.previousElementSibling : row.nextElementSibling) as HTMLTableRowElement | null;

    if (!targetRow) {
      if (e.key === 'Enter' && isEditable) {
        e.preventDefault();
        addItem();
      }
      return;
    }

    const nextInput = targetRow.cells?.[cell.cellIndex]?.querySelector(
      'input:not([type=checkbox])'
    ) as HTMLInputElement | null;

    if (nextInput && !nextInput.disabled) {
      e.preventDefault();
      nextInput.focus();
      nextInput.select?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditable]);

  const startResize = useCallback((e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = columnWidths[colKey] || 100;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setColumnWidths(prev => ({
        ...prev,
        [colKey]: Math.max(30, startWidth + deltaX),
      }));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [columnWidths]);

  // --- Workflow Progress ---
  const currentStepIndex = BOQ_STATUSES.indexOf(boqStatus);
  const progressWidth = BOQ_STATUSES.length > 1
    ? `${(currentStepIndex / (BOQ_STATUSES.length - 1)) * 100}%`
    : '0%';

  // --- Loading State ---
  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner"></div>
        <p style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-secondary)' }}>
          Loading Estimator Grid...
        </p>
      </div>
    );
  }

  // --- Access Locked ---
  if (!tender || (tender.status !== 'Approved' && tender.status !== 'Completed')) {
    return (
      <div className="boq-container">
        <div className="boq-header">
          <div className="boq-header-left">
            <Link href={`/tenders/${tenderId}`} className="logout-btn" style={{ textDecoration: 'none', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
              <ArrowLeft size={14} /> Back to Tender
            </Link>
          </div>
        </div>
        <div className="boq-create-card">
          <Lock className="boq-create-icon" style={{ color: 'var(--text-muted)' }} />
          <h2 className="boq-create-title">BOQ Module Locked</h2>
          <p className="boq-create-desc">
            The Bill of Quantities estimator is available only after the tender is approved. Current tender status: <strong>{tender?.status || 'Unknown'}</strong>
          </p>
        </div>
      </div>
    );
  }

  // --- BOQ Not Created Yet ---
  if (!boqExists) {
    return (
      <div className="boq-container boq-animate-in">
        <div className="boq-header">
          <div className="boq-header-left">
            <Link href={`/tenders/${tenderId}`} className="logout-btn" style={{ textDecoration: 'none', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
              <ArrowLeft size={14} /> Back to Tender
            </Link>
            <h1 className="boq-title">Bill of Quantities</h1>
            <span className="boq-tender-ref">
              <Layers size={14} /> {tender.project_name} — {tender.client_name}
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="boq-readonly-banner" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)', color: '#fca5a5' }}>
            <AlertCircle size={18} />
            <span className="banner-text">{errorMsg}</span>
          </div>
        )}

        <div className="boq-create-card">
          <Calculator className="boq-create-icon" />
          <h2 className="boq-create-title">Initialize BOQ Workspace</h2>
          <p className="boq-create-desc">
            This tender is approved. Create the BOQ to initiate detailed engineering breakdowns, subcontractor costings, global buffers, and client pricing templates.
          </p>
          <button
            className="action-btn btn-primary"
            onClick={handleCreateBOQ}
            disabled={saving}
            style={{ marginTop: '0.5rem' }}
          >
            {saving ? 'Initializing...' : (<><Plus size={16} /> Create BOQ Workspace</>)}
          </button>
        </div>
      </div>
    );
  }

  // --- Main estimation Dashboard ---
  const breadcrumbs = [
    { label: 'COE Cockpit', href: '/dashboard' },
    { label: 'Tenders Registry', href: '/tenders' },
    { label: tender.title.length > 20 ? `${tender.title.substring(0, 20)}...` : tender.title, href: `/tenders/${tenderId}` },
    { label: 'BOQ Workspace' }
  ];

  const actions = (
    <div className="flex items-center gap-2 flex-wrap">
      {isEditable ? (
        <Button variant="primary" size="sm" onClick={handleSave} isLoading={saving} className="font-bold uppercase tracking-wider">
          Save Estimations
        </Button>
      ) : (
        <Button variant="secondary" size="sm" onClick={handleCreateRevision} isLoading={saving} className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
          <GitBranch size={13} /> Create Revision
        </Button>
      )}

      {boqStatus === 'finalized' && (
        activeQuotation ? (
          <Link href={`/quotations/${activeQuotation.id}`} className="no-underline">
            <Button variant="secondary" size="sm" className="text-secondary border-secondary/35 bg-secondary/5 flex items-center gap-1 font-bold">
              <FileText size={13} /> Quote: {activeQuotation.quotation_number}
            </Button>
          </Link>
        ) : (
          <Link href={`/quotations/new/${boqId}`} className="no-underline">
            <Button variant="primary" size="sm" className="flex items-center gap-1 font-bold">
              <Plus size={13} /> Create Quotation
            </Button>
          </Link>
        )
      )}

      <Button variant="secondary" size="sm" onClick={handleExportPDF} className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-red-400 border-red-500/20 hover:bg-red-500/5">
        <FileText size={13} /> PDF
      </Button>
      <Button variant="secondary" size="sm" onClick={handleExportExcel} className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/5">
        <FileSpreadsheet size={13} /> Excel
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => boqId && router.push(`/procurement/rfq/new/${boqId}`)}
        disabled={!boqId}
        title={boqId ? 'Draft a quotation request to suppliers from this BOQ' : 'Save the BOQ first'}
        className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-blue-400 border-blue-500/20 hover:bg-blue-500/5"
      >
        <Mail size={13} /> Request Quotation
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-6" style={{ paddingBottom: '100px' }}>
      {/* Page Header */}
      <PageHeader 
        title="Bill of Quantities Workspace" 
        subtitle={`${tender.project_name} — Client: ${tender.client_name}`}
        referenceId={`BOQ-v${boqVersion}`}
        status={boqStatus}
        breadcrumbs={breadcrumbs}
        actions={actions}
      />

      {/* Messages */}
      {errorMsg && (
        <div className="flex gap-3 bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-200 text-xs items-start">
          <AlertCircle className="flex-shrink-0 text-red-400 mt-0.5" size={18} />
          <div>
            <strong>Estimator Workspace Error</strong>
            <p className="mt-1 leading-relaxed">{errorMsg}</p>
          </div>
        </div>
      )}
      {successMsg && (
        <div className="flex gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 text-emerald-250 text-xs items-start">
          <CheckCircle className="flex-shrink-0 text-emerald-400 mt-0.5" size={18} />
          <div>
            <strong>Action Complete</strong>
            <p className="mt-1 leading-relaxed">{successMsg}</p>
          </div>
        </div>
      )}

      {/* Read-only banner if locked */}
      {!isEditable && (
        <div className="flex gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-amber-200 text-xs items-start">
          <Lock className="flex-shrink-0 text-amber-400 mt-0.5" size={18} />
          <div>
            <strong>BOQ Workspace Locked</strong>
            <p className="mt-1 leading-relaxed">
              This worksheet estimation is finalized and read-only in the <strong className="text-white">{BOQ_STATUS_LABELS[boqStatus]}</strong> stage.
              {boqStatus === 'finalized' && activeQuotation && (
                <span> Linked Active Quotation: <strong className="text-white">{activeQuotation.quotation_number} ({activeQuotation.status})</strong></span>
              )}
              {'. Instantiate a new revision to unlock line adjustments.'}
            </p>
          </div>
        </div>
      )}

      {/* Workflow Progress Bar */}
      <div className="bg-[#0b0f2a] border border-white/5 rounded-xl p-4">
        <div className="relative flex justify-between items-center w-full">
          <div className="absolute top-[14px] left-[20px] right-[20px] h-[2px] bg-white/5 z-0" />
          <div className="absolute top-[14px] left-[20px] h-[2px] bg-gradient-to-r from-secondary to-primary z-10 transition-all duration-500" style={{ width: progressWidth }} />
          {BOQ_STATUSES.map((status, idx) => (
            <div
              key={status}
              className={`flex flex-col items-center relative z-20 flex-1`}
            >
              <div className={`w-[30px] h-[30px] rounded-full flex items-center justify-center text-[10px] font-bold border transition-all ${
                idx < currentStepIndex 
                  ? 'bg-secondary border-secondary text-bg-dark shadow-[0_0_12px_var(--secondary-glow)]' 
                  : idx === currentStepIndex
                  ? 'bg-bg-card border-primary text-primary shadow-[0_0_12px_rgba(0,229,160,0.3)]'
                  : 'bg-bg-card border-white/10 text-text-muted'
              }`}>
                {idx < currentStepIndex ? <Check size={14} /> : idx + 1}
              </div>
              <span className={`text-[9px] font-semibold mt-1.5 text-center max-w-[70px] leading-tight ${
                idx < currentStepIndex
                  ? 'text-text-primary'
                  : idx === currentStepIndex
                  ? 'text-primary font-bold'
                  : 'text-text-muted'
              }`}>{BOQ_STATUS_LABELS[status]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Estimator Sheet Card */}
          <Card className="flex flex-col gap-4 p-4 overflow-hidden" borderAccent="none">
            <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
              <h3 className="font-heading font-bold text-sm text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <FileText size={16} className="text-secondary" />
                Line Items Estimator Sheet
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={toggleCompactView}
                  className="flex items-center gap-1 text-[11px] font-bold"
                  title={compactView ? 'Show the full 38-column cost buildup' : 'Hide intermediate cost columns for a clean pricing sheet'}
                >
                  {compactView ? 'Detailed View' : 'Simple View'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={addItem}
                  disabled={!isEditable}
                  className="flex items-center gap-1 text-[11px] font-bold"
                >
                  <Plus size={12} /> Add Item Line
                </Button>
              </div>
            </div>

            {/* Bulk actions bar */}
            {isEditable && (
              <div className="flex flex-wrap justify-between items-center bg-[#0b0f2a] border border-white/5 rounded-lg p-3 gap-3">
                <span className="text-xs font-bold text-primary font-heading">{selectedIds.size} lines selected</span>
                <div className="flex flex-wrap gap-2 items-center">
                  <Button onClick={handleBulkDuplicate} disabled={selectedIds.size === 0} size="sm" variant="secondary" className="text-[10px] py-1 px-2.5 h-8 flex items-center gap-1 font-bold">
                    <Copy size={11} /> Duplicate
                  </Button>
                  <Button onClick={handleBulkDelete} disabled={selectedIds.size === 0} size="sm" variant="secondary" className="text-[10px] py-1 px-2.5 h-8 flex items-center gap-1 font-bold text-red-400 border-red-500/20 hover:bg-red-500/5">
                    <Trash2 size={11} /> Delete
                  </Button>
                  <Button onClick={() => handleBulkOverride(true)} disabled={selectedIds.size === 0} size="sm" variant="secondary" className="text-[10px] py-1 px-2.5 h-8 font-bold">
                    Override
                  </Button>
                  <Button onClick={() => handleBulkOverride(false)} disabled={selectedIds.size === 0} size="sm" variant="secondary" className="text-[10px] py-1 px-2.5 h-8 font-bold">
                    Inherit Globals
                  </Button>
                  
                  <div className="flex items-center ml-2 border border-white/5 rounded-lg overflow-hidden h-8 bg-bg-dark">
                    <input 
                      type="number" 
                      placeholder="Qty" 
                      value={bulkQty} 
                      onChange={e => setBulkQty(e.target.value !== '' ? Number(e.target.value) : '')}
                      disabled={selectedIds.size === 0}
                      className="w-[50px] bg-transparent text-right text-xs outline-none text-white px-2"
                    />
                    <button 
                      onClick={handleBulkUpdateQty} 
                      disabled={selectedIds.size === 0 || bulkQty === ''} 
                      className="bg-primary/10 border-l border-white/5 hover:bg-primary/20 text-primary px-3 text-[10px] font-bold h-full cursor-pointer transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Table Grid Wrapper with Horizontal Scrolling */}
            <div className="boq-table-scroll-container" onKeyDown={handleGridKeyDown}>
              <table className={`boq-estimator-grid ${compactView ? 'boq-compact' : ''}`}>
                <thead>
                  {/* Tier 1 Header: Group Groupings */}
                  <tr className="tier-1-header">
                    <th rowSpan={2} style={{ width: columnWidths.num }} className="col-num">#</th>
                    <th rowSpan={2} style={{ width: columnWidths.checkbox }} className="col-checkbox">
                      <input 
                        type="checkbox" 
                        checked={items.length > 0 && selectedIds.size === items.length}
                        onChange={e => toggleSelectAll(e.target.checked)}
                      />
                    </th>
                    <th rowSpan={2} style={{ width: columnWidths.actions }} className="col-actions">Actions</th>
                    
                    {/* Group 1: Item Identification */}
                    <th colSpan={5} className="group-header group-1">Group 1: Item Identification</th>
                    
                    {/* Group 2: Supply Cost */}
                    <th colSpan={3} className="group-header group-2">Group 2: Material / Supply Cost</th>
                    
                    {/* Group 3: Labor Breakdown */}
                    <th colSpan={13} className="group-header group-3">Group 3: Labour Cost (Detailed Breakdown)</th>
                    
                    {/* Group 4: Subcontract */}
                    <th colSpan={1} className="group-header group-4">Group 4: Subcontractor</th>
                    
                    {/* Group 5: Equipment */}
                    <th colSpan={1} className="group-header group-5">Group 5: Equipment</th>
                    
                    {/* Group 6: Logistics */}
                    <th colSpan={1} className="group-header group-6">Group 6: Logistics</th>
                    
                    {/* Group 7: Wastage */}
                    <th colSpan={2} className="group-header group-7">Group 7: Wastage</th>
                    
                    {/* Group 8: Risk */}
                    <th colSpan={2} className="group-header group-8">Group 8: Risk</th>
                    
                    {/* Group 9: Site Overhead */}
                    <th colSpan={2} className="group-header group-9">Group 9: Site Overhead</th>
                    
                    {/* Group 10: Total Cost */}
                    <th rowSpan={2} style={{ width: columnWidths.total_cost }} className="col-total-cost">Group 10: Total Cost</th>
                    
                    {/* Group 11: Profit */}
                    <th colSpan={2} className="group-header group-11">Group 11: Profit</th>
                    
                    {/* Group 12: Selling Price */}
                    <th colSpan={2} className="group-header group-12">Group 12: Selling Price</th>
                  </tr>

                  {/* Tier 2 Header: Individual Columns */}
                  <tr className="tier-2-header">
                    {/* Group 1 Items */}
                    <th style={{ width: columnWidths.item_code }} className="resizable">Code
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'item_code')} />
                    </th>
                    <th style={{ width: columnWidths.name }} className="resizable">Description
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'name')} />
                    </th>
                    <th style={{ width: columnWidths.unit }} className="resizable">Unit
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'unit')} />
                    </th>
                    <th style={{ width: columnWidths.quantity }} className="resizable">Qty
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'quantity')} />
                    </th>
                    <th style={{ width: columnWidths.override }} className="resizable">Override
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'override')} />
                    </th>

                    {/* Group 2 Items */}
                    <th style={{ width: columnWidths.supply_unit }} className="resizable">Unit Supply
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'supply_unit')} />
                    </th>
                    <th style={{ width: columnWidths.net_purchase }} className="resizable">Net Purchase
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'net_purchase')} />
                    </th>
                    <th style={{ width: columnWidths.supply_total }} className="resizable">Total Supply
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'supply_total')} />
                    </th>

                    {/* Group 3 Items: Technician, Engineer, PM, Gross */}
                    <th style={{ width: columnWidths.tech_hours }} className="resizable sub-tech">Tech Hours
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'tech_hours')} />
                    </th>
                    <th style={{ width: columnWidths.tech_count }} className="resizable sub-tech">Tech Count
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'tech_count')} />
                    </th>
                    <th style={{ width: columnWidths.tech_rate }} className="resizable sub-tech">Tech Rate
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'tech_rate')} />
                    </th>
                    <th style={{ width: columnWidths.tech_cost }} className="resizable sub-tech">Tech Cost
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'tech_cost')} />
                    </th>

                    <th style={{ width: columnWidths.eng_hours }} className="resizable sub-eng">Eng Hours
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'eng_hours')} />
                    </th>
                    <th style={{ width: columnWidths.eng_count }} className="resizable sub-eng">Eng Count
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'eng_count')} />
                    </th>
                    <th style={{ width: columnWidths.eng_rate }} className="resizable sub-eng">Eng Rate
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'eng_rate')} />
                    </th>
                    <th style={{ width: columnWidths.eng_cost }} className="resizable sub-eng">Eng Cost
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'eng_cost')} />
                    </th>

                    <th style={{ width: columnWidths.pm_hours }} className="resizable sub-pm">PM Hours
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'pm_hours')} />
                    </th>
                    <th style={{ width: columnWidths.pm_count }} className="resizable sub-pm">PM Count
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'pm_count')} />
                    </th>
                    <th style={{ width: columnWidths.pm_rate }} className="resizable sub-pm">PM Rate
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'pm_rate')} />
                    </th>
                    <th style={{ width: columnWidths.pm_cost }} className="resizable sub-pm">PM Cost
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'pm_cost')} />
                    </th>
                    <th style={{ width: columnWidths.gross_labour }} className="resizable">Gross Labour
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'gross_labour')} />
                    </th>

                    {/* Group 4 Subcontract */}
                    <th style={{ width: columnWidths.subcontract }} className="resizable">Subcontract Cost
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'subcontract')} />
                    </th>

                    {/* Group 5 Equipment */}
                    <th style={{ width: columnWidths.equipment }} className="resizable">Equipment Cost
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'equipment')} />
                    </th>

                    {/* Group 6 Logistics */}
                    <th style={{ width: columnWidths.logistics }} className="resizable">Logistics Cost
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'logistics')} />
                    </th>

                    {/* Group 7 Wastage */}
                    <th style={{ width: columnWidths.wastage_pct }} className="resizable">Wastage %
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'wastage_pct')} />
                    </th>
                    <th style={{ width: columnWidths.wastage_cost }} className="resizable">Wastage Cost
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'wastage_cost')} />
                    </th>

                    {/* Group 8 Risk */}
                    <th style={{ width: columnWidths.risk_pct }} className="resizable">Risk %
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'risk_pct')} />
                    </th>
                    <th style={{ width: columnWidths.risk_cost }} className="resizable">Risk Cost
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'risk_cost')} />
                    </th>

                    {/* Group 9 Site Overhead */}
                    <th style={{ width: columnWidths.site_overhead_pct }} className="resizable">Overhead %
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'site_overhead_pct')} />
                    </th>
                    <th style={{ width: columnWidths.site_overhead_cost }} className="resizable">Overhead Cost
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'site_overhead_cost')} />
                    </th>

                    {/* Group 11 Profit */}
                    <th style={{ width: columnWidths.profit_pct }} className="resizable">Profit %
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'profit_pct')} />
                    </th>
                    <th style={{ width: columnWidths.profit_cost }} className="resizable">Profit Cost
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'profit_cost')} />
                    </th>

                    {/* Group 12 Selling Price */}
                    <th style={{ width: columnWidths.unit_selling }} className="resizable">Unit Selling
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'unit_selling')} />
                    </th>
                    <th style={{ width: columnWidths.total_selling }} className="resizable">Total Selling
                      <div className="resize-handle" onMouseDown={e => startResize(e, 'total_selling')} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const selected = selectedIds.has(item.id);
                    const override = !!item.override_settings;

                    return (
                      <tr key={item.id} className={`${selected ? 'row-selected' : ''} ${override ? 'row-overridden' : ''}`}>
                        <td className="col-num-val">{idx + 1}</td>
                        <td className="col-checkbox-val">
                          <input 
                            type="checkbox"
                            checked={selected}
                            onChange={e => toggleSelectRow(item.id, e.target.checked)}
                          />
                        </td>
                        <td className="col-actions-val">
                          <div style={{ display: 'flex', gap: '0.2rem', justifyContent: 'center' }}>
                            <button className="row-action-btn copy" onClick={() => duplicateItem(item.id)} disabled={!isEditable} title="Duplicate Line">
                              <Copy size={12} />
                            </button>
                            <button className="row-action-btn delete" onClick={() => removeItem(item.id)} disabled={!isEditable || items.length <= 1} title="Delete Line">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>

                        {/* Group 1 Inputs */}
                        <td>
                          <div className="boq-autocomplete-wrapper">
                            <input
                              type="text"
                              className="excel-cell-input"
                              placeholder="Code…"
                              value={item.item_code || ''}
                              onChange={e => {
                                updateItem(item.id, 'item_code', e.target.value);
                                setFocusedItemId(item.id);
                                setFocusedField('code');
                                setSearchQuery(e.target.value);
                              }}
                              onFocus={() => {
                                setFocusedItemId(item.id);
                                setFocusedField('code');
                                setSearchQuery(item.item_code || '');
                              }}
                              onBlur={() => {
                                setTimeout(() => setFocusedItemId(null), 250);
                              }}
                              disabled={!isEditable}
                            />
                            {focusedItemId === item.id && focusedField === 'code' && (
                              <SuggestionsDropdown
                                query={searchQuery}
                                catalog={catalog}
                                onSelect={(selectedItem) => applyCatalogSelection(item.id, selectedItem)}
                              />
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="boq-autocomplete-wrapper">
                            <input 
                              type="text" 
                              className="excel-cell-input" 
                              placeholder="Search or describe..." 
                              value={item.name} 
                              onChange={(e) => {
                                updateItem(item.id, 'name', e.target.value);
                                setFocusedItemId(item.id);
                                setFocusedField('name');
                                setSearchQuery(e.target.value);
                              }}
                              onFocus={() => {
                                setFocusedItemId(item.id);
                                setFocusedField('name');
                                setSearchQuery(item.name);
                              }}
                              onBlur={() => {
                                setTimeout(() => setFocusedItemId(null), 250);
                              }}
                              disabled={!isEditable} 
                            />
                            {focusedItemId === item.id && focusedField === 'name' && (
                              <SuggestionsDropdown
                                query={searchQuery}
                                catalog={catalog}
                                onSelect={(selectedItem) => applyCatalogSelection(item.id, selectedItem)}
                              />
                            )}
                          </div>
                        </td>
                        <td>
                          <input 
                            type="text" 
                            className="excel-cell-input text-center" 
                            value={item.unit || 'Pcs'}
                            onChange={e => updateItem(item.id, 'unit', e.target.value)}
                            disabled={!isEditable}
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            className="excel-cell-input text-right" 
                            value={item.quantity}
                            onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                            disabled={!isEditable}
                          />
                        </td>
                        <td className="text-center">
                          <input 
                            type="checkbox"
                            checked={override}
                            onChange={e => toggleOverride(item.id, e.target.checked)}
                            disabled={!isEditable}
                            title="Override global settings for this item"
                          />
                        </td>

                        {/* Group 2 Inputs */}
                        <td>
                          <input 
                            type="number" 
                            className="excel-cell-input text-right" 
                            step="0.01"
                            value={item.material_unit_cost}
                            onChange={e => updateItem(item.id, 'material_unit_cost', parseFloat(e.target.value) || 0)}
                            disabled={!isEditable}
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            className="excel-cell-input text-right" 
                            step="0.01"
                            value={item.net_purchase_cost_per_unit ?? item.material_unit_cost}
                            onChange={e => updateItem(item.id, 'net_purchase_cost_per_unit', parseFloat(e.target.value) || 0)}
                            disabled={!isEditable}
                          />
                        </td>
                        <td className="cell-readonly text-right">{formatCurrency(item.material_total_cost)}</td>

                        {/* Group 3 Inputs: Technician */}
                        <td>
                          <input 
                            type="number" 
                            className="excel-cell-input text-right" 
                            step="0.1"
                            value={item.labor_technician_hours || 0}
                            onChange={e => updateItem(item.id, 'labor_technician_hours', parseFloat(e.target.value) || 0)}
                            disabled={!isEditable}
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            className="excel-cell-input text-right" 
                            value={item.labor_technician_count || 0}
                            onChange={e => updateItem(item.id, 'labor_technician_count', parseInt(e.target.value) || 0)}
                            disabled={!isEditable}
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            className={`excel-cell-input text-right ${override ? 'cell-input-override' : 'cell-inherited'}`} 
                            step="0.01"
                            value={item.labor_technician_rate || 0}
                            onChange={e => updateItem(item.id, 'labor_technician_rate', parseFloat(e.target.value) || 0)}
                            disabled={!isEditable || !override}
                          />
                        </td>
                        <td className="cell-readonly text-right">{formatCurrency(item.labor_technician_cost || 0)}</td>

                        {/* Group 3 Inputs: Engineer */}
                        <td>
                          <input 
                            type="number" 
                            className="excel-cell-input text-right" 
                            step="0.1"
                            value={item.labor_engineer_hours || 0}
                            onChange={e => updateItem(item.id, 'labor_engineer_hours', parseFloat(e.target.value) || 0)}
                            disabled={!isEditable}
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            className="excel-cell-input text-right" 
                            value={item.labor_engineer_count || 0}
                            onChange={e => updateItem(item.id, 'labor_engineer_count', parseInt(e.target.value) || 0)}
                            disabled={!isEditable}
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            className={`excel-cell-input text-right ${override ? 'cell-input-override' : 'cell-inherited'}`} 
                            step="0.01"
                            value={item.labor_engineer_rate || 0}
                            onChange={e => updateItem(item.id, 'labor_engineer_rate', parseFloat(e.target.value) || 0)}
                            disabled={!isEditable || !override}
                          />
                        </td>
                        <td className="cell-readonly text-right">{formatCurrency(item.labor_engineer_cost || 0)}</td>

                        {/* Group 3 Inputs: PM */}
                        <td>
                          <input 
                            type="number" 
                            className="excel-cell-input text-right" 
                            step="0.1"
                            value={item.labor_pm_hours || 0}
                            onChange={e => updateItem(item.id, 'labor_pm_hours', parseFloat(e.target.value) || 0)}
                            disabled={!isEditable}
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            className="excel-cell-input text-right" 
                            value={item.labor_pm_count || 0}
                            onChange={e => updateItem(item.id, 'labor_pm_count', parseInt(e.target.value) || 0)}
                            disabled={!isEditable}
                          />
                        </td>
                        <td>
                          <input 
                            type="number" 
                            className={`excel-cell-input text-right ${override ? 'cell-input-override' : 'cell-inherited'}`} 
                            step="0.01"
                            value={item.labor_pm_rate || 0}
                            onChange={e => updateItem(item.id, 'labor_pm_rate', parseFloat(e.target.value) || 0)}
                            disabled={!isEditable || !override}
                          />
                        </td>
                        <td className="cell-readonly text-right">{formatCurrency(item.labor_pm_cost || 0)}</td>

                        <td className="cell-readonly text-right highlight-subtotal">{formatCurrency(item.gross_labour_cost || 0)}</td>

                        {/* Group 4 Subcontract */}
                        <td>
                          <input 
                            type="number" 
                            className="excel-cell-input text-right" 
                            step="0.01"
                            value={item.subcontract_cost || 0}
                            onChange={e => updateItem(item.id, 'subcontract_cost', parseFloat(e.target.value) || 0)}
                            disabled={!isEditable}
                            placeholder="e.g. Civil..."
                          />
                        </td>

                        {/* Group 5 Equipment */}
                        <td>
                          <input 
                            type="number" 
                            className="excel-cell-input text-right" 
                            step="0.01"
                            value={item.equipment_cost || 0}
                            onChange={e => updateItem(item.id, 'equipment_cost', parseFloat(e.target.value) || 0)}
                            disabled={!isEditable}
                            placeholder="e.g. Fusion..."
                          />
                        </td>

                        {/* Group 6 Logistics */}
                        <td>
                          <input 
                            type="number" 
                            className="excel-cell-input text-right" 
                            step="0.01"
                            value={item.logistics_cost || 0}
                            onChange={e => updateItem(item.id, 'logistics_cost', parseFloat(e.target.value) || 0)}
                            disabled={!isEditable}
                            placeholder="e.g. Fuel..."
                          />
                        </td>

                        {/* Group 7 Wastage */}
                        <td>
                          <input 
                            type="number" 
                            className={`excel-cell-input text-right ${override ? 'cell-input-override' : 'cell-inherited'}`} 
                            step="0.1"
                            value={item.wastage_pct}
                            onChange={e => updateItem(item.id, 'wastage_pct', parseFloat(e.target.value) || 0)}
                            disabled={!isEditable || !override}
                          />
                        </td>
                        <td className="cell-readonly text-right">{formatCurrency(item.wastage_cost)}</td>

                        {/* Group 8 Risk */}
                        <td>
                          <input 
                            type="number" 
                            className={`excel-cell-input text-right ${override ? 'cell-input-override' : 'cell-inherited'}`} 
                            step="0.1"
                            value={item.risk_pct || 0}
                            onChange={e => updateItem(item.id, 'risk_pct', parseFloat(e.target.value) || 0)}
                            disabled={!isEditable || !override}
                          />
                        </td>
                        <td className="cell-readonly text-right">{formatCurrency(item.risk_cost)}</td>

                        {/* Group 9 Site Overhead */}
                        <td>
                          <input 
                            type="number" 
                            className={`excel-cell-input text-right ${override ? 'cell-input-override' : 'cell-inherited'}`} 
                            step="0.1"
                            value={item.site_overhead_pct || 0}
                            onChange={e => updateItem(item.id, 'site_overhead_pct', parseFloat(e.target.value) || 0)}
                            disabled={!isEditable || !override}
                          />
                        </td>
                        <td className="cell-readonly text-right">{formatCurrency(item.site_overhead_cost)}</td>

                        {/* Group 10 Total Cost */}
                        <td className="cell-readonly text-right highlight-total">{formatCurrency(item.total_cost || 0)}</td>

                        {/* Group 11 Profit */}
                        <td>
                          <input 
                            type="number" 
                            className={`excel-cell-input text-right ${override ? 'cell-input-override' : 'cell-inherited'}`} 
                            step="0.1"
                            value={item.profit_pct}
                            onChange={e => updateItem(item.id, 'profit_pct', parseFloat(e.target.value) || 0)}
                            disabled={!isEditable || !override}
                          />
                        </td>
                        <td className="cell-readonly text-right">{formatCurrency(item.profit_value)}</td>

                        {/* Group 12 Selling Price */}
                        <td className="cell-readonly text-right highlight-selling" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{formatCurrency(item.unit_price)}</td>
                        <td className="cell-readonly text-right highlight-selling">{formatCurrency(item.total_price)}</td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Pinned column totals */}
                <tfoot>
                  <tr className="boq-totals-row">
                    <td className="col-num-val">Σ</td>
                    <td></td>
                    <td></td>
                    <td className="t-label">TOTALS</td>
                    <td className="t-label">{items.length} line{items.length === 1 ? '' : 's'}</td>
                    <td></td>
                    <td className="t-num">{items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td className="t-num">{fmtNum(items.reduce((s, i) => s + (i.material_total_cost || 0), 0))}</td>
                    <td></td><td></td><td></td>
                    <td className="t-num">{fmtNum(items.reduce((s, i) => s + (i.labor_technician_cost || 0), 0))}</td>
                    <td></td><td></td><td></td>
                    <td className="t-num">{fmtNum(items.reduce((s, i) => s + (i.labor_engineer_cost || 0), 0))}</td>
                    <td></td><td></td><td></td>
                    <td className="t-num">{fmtNum(items.reduce((s, i) => s + (i.labor_pm_cost || 0), 0))}</td>
                    <td className="t-num">{fmtNum(items.reduce((s, i) => s + (i.gross_labour_cost || 0), 0))}</td>
                    <td className="t-num">{fmtNum(items.reduce((s, i) => s + (i.subcontract_cost || 0), 0))}</td>
                    <td className="t-num">{fmtNum(items.reduce((s, i) => s + (i.equipment_cost || 0), 0))}</td>
                    <td className="t-num">{fmtNum(items.reduce((s, i) => s + (i.logistics_cost || 0), 0))}</td>
                    <td></td>
                    <td className="t-num">{fmtNum(items.reduce((s, i) => s + (i.wastage_cost || 0), 0))}</td>
                    <td></td>
                    <td className="t-num">{fmtNum(items.reduce((s, i) => s + (i.risk_cost || 0), 0))}</td>
                    <td></td>
                    <td className="t-num">{fmtNum(items.reduce((s, i) => s + (i.site_overhead_cost || 0), 0))}</td>
                    <td className="t-num t-strong">{fmtNum(items.reduce((s, i) => s + (i.total_cost || 0), 0))}</td>
                    <td></td>
                    <td className="t-num">{fmtNum(items.reduce((s, i) => s + (i.profit_value || 0), 0))}</td>
                    <td></td>
                    <td className="t-num t-strong">{fmtNum(items.reduce((s, i) => s + (i.total_price || 0), 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="boq-supply-total-row" style={{ marginTop: '0.8rem' }}>
              <span className="boq-supply-total-label">Subtotal Material Supply</span>
              <span className="boq-supply-total-value">{formatCurrency(financials.supply_total)}</span>
            </div>
          </Card>

          {/* Global Cost Settings Panel */}
          <Card className="flex flex-col gap-4 p-4" borderAccent="none">
            <h3 className="font-heading font-bold text-sm text-slate-200 uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2.5">
              <Calculator size={16} className="text-accent" />
              Global Estimating Settings Panel
            </h3>

            <div className="boq-settings-panel-grid">
              
              <div className="settings-section">
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Markup Buffers (Inherited by Lines)</div>
                
                <div className="boq-cost-row">
                  <span className="boq-cost-label">Global Wastage %</span>
                  <input 
                    type="number" 
                    className="boq-cost-input pct-input" 
                    min="0" max="100" step="0.1" 
                    value={costElements.wastage_pct} 
                    onChange={e => updateGlobalSetting('wastage_pct', parseFloat(e.target.value) || 0)} 
                    disabled={!isEditable} 
                  />
                </div>

                <div className="boq-cost-row">
                  <span className="boq-cost-label">Global Risk %</span>
                  <input 
                    type="number" 
                    className="boq-cost-input pct-input" 
                    min="0" max="100" step="0.1" 
                    value={costElements.risk_pct} 
                    onChange={e => updateGlobalSetting('risk_pct', parseFloat(e.target.value) || 0)} 
                    disabled={!isEditable} 
                  />
                </div>

                <div className="boq-cost-row">
                  <span className="boq-cost-label">Global Site Overhead %</span>
                  <input 
                    type="number" 
                    className="boq-cost-input pct-input" 
                    min="0" max="100" step="0.1" 
                    value={costElements.site_overhead_pct} 
                    onChange={e => updateGlobalSetting('site_overhead_pct', parseFloat(e.target.value) || 0)} 
                    disabled={!isEditable} 
                  />
                </div>

                <div className="boq-cost-row">
                  <span className="boq-cost-label">Global Profit %</span>
                  <input 
                    type="number" 
                    className="boq-cost-input pct-input" 
                    min="0" max="100" step="0.1" 
                    value={costElements.profit_pct} 
                    onChange={e => updateGlobalSetting('profit_pct', parseFloat(e.target.value) || 0)} 
                    disabled={!isEditable} 
                  />
                </div>
              </div>

              <div className="settings-section">
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Global Labour Rates (AED/Hour)</div>
                
                <div className="boq-cost-row">
                  <span className="boq-cost-label">Technician Hourly Rate</span>
                  <input 
                    type="number" 
                    className="boq-cost-input" 
                    min="0" step="0.5" 
                    value={costElements.technician_rate} 
                    onChange={e => updateGlobalSetting('technician_rate', parseFloat(e.target.value) || 0)} 
                    disabled={!isEditable} 
                  />
                </div>

                <div className="boq-cost-row">
                  <span className="boq-cost-label">Engineer Hourly Rate</span>
                  <input 
                    type="number" 
                    className="boq-cost-input" 
                    min="0" step="0.5" 
                    value={costElements.engineer_rate} 
                    onChange={e => updateGlobalSetting('engineer_rate', parseFloat(e.target.value) || 0)} 
                    disabled={!isEditable} 
                  />
                </div>

                <div className="boq-cost-row">
                  <span className="boq-cost-label">Project Manager Hourly Rate</span>
                  <input 
                    type="number" 
                    className="boq-cost-input" 
                    min="0" step="0.5" 
                    value={costElements.pm_rate} 
                    onChange={e => updateGlobalSetting('pm_rate', parseFloat(e.target.value) || 0)} 
                    disabled={!isEditable} 
                  />
                </div>
              </div>

              <div className="settings-section actions-panel justify-center">
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Apply Configurations</div>
                <div className="flex flex-col gap-2">
                  <Button 
                    variant="secondary"
                    size="sm"
                    onClick={applyGlobalsToAll}
                    disabled={!isEditable}
                    className="w-full text-xs font-bold uppercase tracking-wider h-9"
                  >
                    Apply To All Items
                  </Button>
                  <Button 
                    variant="secondary"
                    size="sm"
                    onClick={applyGlobalsToSelected}
                    disabled={!isEditable}
                    className="w-full text-xs font-bold uppercase tracking-wider h-9"
                  >
                    Apply To Selected ({selectedIds.size})
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="flex flex-col gap-6">
          
          {/* Approval Actions */}
          <Card className="flex flex-col gap-4" borderAccent="none">
            <h3 className="font-heading font-bold text-sm text-slate-200 uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2.5">
              <Shield size={16} className="text-primary shrink-0" />
              Workflow Actions
            </h3>

            {profile && (
              <div className="text-[10px] text-text-muted font-mono leading-relaxed bg-[#0b0f2a] border border-white/5 p-2 rounded-lg">
                User: <span className="text-text-primary font-semibold">{profile.full_name}</span><br />
                Role: <span className="text-primary font-bold uppercase">{profile.role}</span>
              </div>
            )}

            <textarea 
              className="w-full bg-bg-dark border border-border-color rounded-lg px-3 py-2 text-xs text-text-primary placeholder-text-muted outline-none transition-all duration-100 min-h-[60px] resize-none focus:border-border-focus"
              placeholder="Add an approval/rejection note..." 
              value={approvalNote} 
              onChange={(e) => setApprovalNote(e.target.value)} 
            />

            <div className="flex flex-col gap-2 mt-1">
              {boqStatus === 'draft' && (
                <Button 
                  onClick={handleSubmit} 
                  disabled={saving}
                  variant="primary"
                  className="w-full flex items-center justify-center gap-1.5 font-bold uppercase tracking-wider text-xs"
                >
                  <Send size={12} /> Submit for Review
                </Button>
              )}

              {profile && canRoleApprove(profile.role, boqStatus) && (
                <Button 
                  onClick={handleApprove} 
                  disabled={saving}
                  variant="primary"
                  className="w-full flex items-center justify-center gap-1.5 font-bold uppercase tracking-wider text-xs bg-emerald-500/10 border-emerald-500/20 text-emerald-450 hover:bg-emerald-500/20"
                >
                  <CheckCircle size={12} /> Approve ({BOQ_STATUS_LABELS[getNextApprovalStatus(profile.role, boqStatus) || boqStatus]})
                </Button>
              )}

              {profile && canRoleApprove(profile.role, boqStatus) && (
                <Button 
                  onClick={handleReject} 
                  disabled={saving}
                  variant="secondary"
                  className="w-full flex items-center justify-center gap-1.5 font-bold uppercase tracking-wider text-xs text-red-400 border-red-500/20 hover:bg-red-500/5"
                >
                  <XCircle size={12} /> Reject to Draft
                </Button>
              )}

              {boqStatus === 'finance_approved' && profile && (profile.role === 'admin' || profile.role === 'manager') && (
                <Button 
                  onClick={handleFinalize} 
                  disabled={saving}
                  variant="primary"
                  className="w-full flex items-center justify-center gap-1.5 font-bold uppercase tracking-wider text-xs bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20"
                >
                  <Award size={12} /> Finalize BOQ
                </Button>
              )}
            </div>
          </Card>

          {/* Approval History Log */}
          {approvalHistory.length > 0 && (
            <Card className="flex flex-col gap-4" borderAccent="none">
              <h3 className="font-heading font-bold text-sm text-slate-200 uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2.5">
                <Clock size={16} className="text-secondary shrink-0" />
                Workflow History Log
              </h3>
              
              <div className="relative border-l border-border-color pl-4 ml-2.5 flex flex-col gap-4 py-1">
                {approvalHistory.map((entry, idx) => {
                  const isActive = idx === 0;
                  return (
                    <div key={idx} className="relative flex flex-col gap-1.5 bg-bg-dark/30 hover:bg-bg-dark/50 border border-border-color/40 p-3 rounded-lg transition-colors group">
                      {/* Timeline dot */}
                      <span className={`absolute -left-[21px] top-4 h-2.5 w-2.5 rounded-full border ${
                        isActive 
                          ? 'bg-primary border-primary shadow-[0_0_8px_var(--primary-glow)]' 
                          : 'bg-bg-dark border-border-color'
                      }`} />
                      
                      <div className="flex justify-between items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-primary' : 'text-text-secondary'}`}>
                          {entry.stage}
                        </span>
                        <span className="text-[9px] text-text-muted font-mono shrink-0">
                          {new Date(entry.approved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1 text-[10px] text-text-muted font-mono leading-none">
                        <User size={10} className="shrink-0" />
                        <span>{entry.approved_by}</span>
                      </div>
                      
                      {entry.note && (
                        <p className="text-[10px] text-text-secondary bg-bg-dark/50 px-2 py-1 rounded border border-border-color/20 mt-0.5 italic leading-normal">
                          "{entry.note}"
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Version History Log */}
          {versions.length > 0 && (
            <Card className="flex flex-col gap-4" borderAccent="none">
              <h3 className="font-heading font-bold text-sm text-slate-200 uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2.5">
                <GitBranch size={16} className="text-accent shrink-0" />
                Snapshot Version Log
              </h3>
              
              <div className="relative border-l border-border-color pl-4 ml-2.5 flex flex-col gap-4 py-1">
                {versions.map((v, idx) => {
                  const isActive = idx === 0;
                  return (
                    <div key={v.id} className="relative flex flex-col gap-1.5 bg-bg-dark/30 hover:bg-bg-dark/50 border border-border-color/40 p-3 rounded-lg transition-colors group">
                      {/* Timeline dot */}
                      <span className={`absolute -left-[21px] top-4 h-2.5 w-2.5 rounded-full border ${
                        isActive 
                          ? 'bg-accent border-accent shadow-[0_0_8px_var(--accent-glow)]' 
                          : 'bg-bg-dark border-border-color'
                      }`} />
                      
                      <div className="flex justify-between items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-accent' : 'text-text-secondary'}`}>
                          Version v{v.version}
                        </span>
                        <span className="text-[9px] text-text-muted font-mono shrink-0">
                          {new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1 text-[10px] text-text-muted font-mono leading-none">
                        <User size={10} className="shrink-0" />
                        <span>Snapshot Saved</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Premium Sticky Summary Footer */}
      <div className="boq-sticky-summary-footer bg-bg-dark/95 border-t border-border-color backdrop-blur-md shadow-[0_-8px_32px_rgba(0,0,0,0.6)] py-2 select-none h-[80px]">
        <div className="summary-footer-inner flex justify-between items-center w-full max-w-[1800px] mx-auto px-6 gap-3 overflow-x-auto">
          {[
            { label: 'Materials Cost', value: financials.supply_total, type: 'normal' },
            { label: 'Labour Cost', value: financials.labor_total, type: 'normal' },
            { label: 'Subcontract Cost', value: financials.subcontract_cost, type: 'normal' },
            { label: 'Equipment Cost', value: financials.equipment_cost, type: 'normal' },
            { label: 'Logistics Cost', value: financials.logistics_cost, type: 'normal' },
            { label: 'Total Wastage', value: financials.wastage_value, type: 'normal' },
            { label: 'Total Risk', value: financials.risk_cost, type: 'normal' },
            { label: 'Site Overhead', value: financials.overhead_value, type: 'normal', isBorder: true },
            { label: 'Total Cost', value: financials.direct_total + financials.indirect_total, type: 'total-cost' },
            { label: 'Total Profit', value: financials.profit_value, type: 'normal' },
            { label: 'Grand Selling Price', value: financials.total_selling_price, type: 'grand-total' }
          ].map((item, index) => {
            const isNormal = item.type === 'normal';
            const isTotalCost = item.type === 'total-cost';
            const isGrandTotal = item.type === 'grand-total';

            return (
              <div 
                key={index} 
                className={`flex flex-col items-start px-3 py-1.5 rounded-lg transition-all hover:-translate-y-0.5 whitespace-nowrap min-w-[110px] ${
                  isGrandTotal 
                    ? 'bg-primary/10 border border-primary/20 shadow-[0_0_12px_rgba(0,229,160,0.1)] px-4' 
                    : isTotalCost
                    ? 'bg-amber-500/10 border border-amber-500/20 px-3'
                    : 'bg-bg-card border border-border-color/30'
                } ${item.isBorder ? 'border-r-2 border-r-border-color/20 pr-4' : ''}`}
              >
                <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider">{item.label}</span>
                <span className={`text-xs font-mono font-bold mt-0.5 ${
                  isGrandTotal 
                    ? 'text-primary text-sm' 
                    : isTotalCost
                    ? 'text-warning'
                    : 'text-text-primary'
                }`}>
                  {formatCurrency(item.value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


// --- Suggestions Autocomplete Dropdown ---
type QuotedHistory = { price: number; client: string; date: string };

function SuggestionsDropdown({
  query,
  catalog,
  onSelect,
}: {
  query: string;
  catalog: any[];
  onSelect: (item: any) => void;
}) {
  const [history, setHistory] = useState<Record<string, QuotedHistory>>({});

  const filtered = catalog.filter(item => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      (item.description && item.description.toLowerCase().includes(q)) ||
      (item.item_code && item.item_code.toLowerCase().includes(q)) ||
      (item.brand && item.brand.toLowerCase().includes(q)) ||
      (item.system && item.system.toLowerCase().includes(q))
    );
  }).slice(0, 8); // show top 8 matches

  // Price intelligence: latest sell price quoted per item code (any client)
  const codesKey = filtered.map(f => f.item_code).filter(Boolean).join(',');
  useEffect(() => {
    if (!codesKey) return;
    let cancelled = false;
    const codes = codesKey.split(',');
    supabase
      .from('quotation_lines')
      .select('item_code, unit_sell_price_after_discount, quotation:quotations(client_name, created_at)')
      .in('item_code', codes)
      .limit(100)
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const map: Record<string, QuotedHistory> = {};
        const rows = [...data].sort((a: any, b: any) =>
          new Date(b.quotation?.created_at || 0).getTime() - new Date(a.quotation?.created_at || 0).getTime()
        );
        for (const row of rows as any[]) {
          if (!row.item_code || map[row.item_code]) continue;
          map[row.item_code] = {
            price: Number(row.unit_sell_price_after_discount) || 0,
            client: row.quotation?.client_name || '—',
            date: row.quotation?.created_at || '',
          };
        }
        setHistory(map);
      });
    return () => { cancelled = true; };
  }, [codesKey]);

  if (filtered.length === 0) return null;

  return (
    <div className="boq-suggestions-dropdown">
      {filtered.map(item => {
        const quoted = item.item_code ? history[item.item_code] : undefined;
        return (
          <div
            key={item.id}
            className="boq-suggestion-item"
            onMouseDown={() => onSelect(item)}
          >
            <div className="boq-suggestion-code">
              {item.item_code} <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>| {item.brand || 'No Brand'}</span>
              {item.stock_status && (
                <span className="boq-suggestion-stock">{String(item.stock_status).replace(/_/g, ' ')}</span>
              )}
            </div>
            <div className="boq-suggestion-desc">{item.description}</div>
            <div className="boq-suggestion-meta">
              Material Cost: {formatCurrency(item.material_cost)} | System: {item.system}
            </div>
            <div className="boq-suggestion-price-intel">
              {quoted ? (
                <span className="intel-quoted">
                  Last quoted {formatCurrency(quoted.price)} · {quoted.client}
                  {quoted.date ? ` · ${new Date(quoted.date).toLocaleDateString('en-AE')}` : ''}
                </span>
              ) : (
                <span className="intel-none">No previous quotes</span>
              )}
              <span className="intel-market" title="Online market pricing arrives with the AI integration">
                Market avg: —
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
