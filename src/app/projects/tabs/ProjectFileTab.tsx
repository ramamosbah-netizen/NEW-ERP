// ============================================================
// JEET ERP — Unified Project File Tab Component
// Location: src/app/projects/tabs/ProjectFileTab.tsx
// Theme: Bloomberg Terminal Electric Mint
// Grouped aggregation and deep links for the entire project lifecycle
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { 
  Folder, 
  FileText, 
  Building2, 
  Layers, 
  TrendingUp, 
  ShoppingCart, 
  Truck, 
  DollarSign, 
  Briefcase, 
  FileCheck, 
  History, 
  RefreshCw, 
  ChevronDown, 
  ChevronRight,
  ArrowRight,
  ShieldAlert,
  FileCode,
  FileCheck2
} from 'lucide-react';

interface ProjectFileTabProps {
  projectId: string;
  projectNumber: string;
  tenderId?: string;
  boqId?: string;
}

export default function ProjectFileTab({ projectId, projectNumber, tenderId, boqId }: ProjectFileTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // States for aggregated data
  const [tender, setTender] = useState<any>(null);
  const [boq, setBoq] = useState<any>(null);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [comparisons, setComparisons] = useState<any[]>([]);
  const [variationOrders, setVariationOrders] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [grns, setGrns] = useState<any[]>([]);
  const [clientInvoices, setClientInvoices] = useState<any[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<any[]>([]);
  const [clientPayments, setClientPayments] = useState<any[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);

  // Tree UI states
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({
    TENDERING: true,
    COMMERCIAL: true,
    PROCUREMENT: true,
    FINANCE: true,
    DMS: true
  });

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const fmtAED = (v: number) => {
    return 'AED ' + new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  };

  const loadProjectFile = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch Tender
      if (tenderId) {
        const { data: tData } = await supabase
          .from('tenders')
          .select('*')
          .eq('id', tenderId)
          .single();
        if (tData) setTender(tData);
      }

      // 2. Fetch BOQ
      if (boqId) {
        const { data: bData } = await supabase
          .from('boqs')
          .select('id, status, version, created_at')
          .eq('id', boqId)
          .single();
        if (bData) setBoq(bData);
      }

      // 3. Fetch Quotations
      const { data: qData } = await supabase
        .from('quotations')
        .select('id, quotation_number, revision, revision_label, status, grand_total_with_vat, quotation_date')
        .eq('actual_project_id', projectId)
        .order('revision', { ascending: false });
      if (qData) setQuotations(qData);

      // 4. Fetch Comparisons
      const { data: cData } = await supabase
        .from('supplier_comparisons')
        .select('id, comparison_number, revision, status, overall_margin_pct, total_selected_supplier_cost, comparison_date')
        .eq('actual_project_id', projectId)
        .order('revision', { ascending: false });
      if (cData) setComparisons(cData);

      // 5. Fetch VOs
      const { data: voData } = await supabase
        .from('variation_orders')
        .select('id, vo_number, status, total_cost_impact_sell, approval_date')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (voData) setVariationOrders(voData);

      // 6. Fetch POs
      const { data: poData } = await supabase
        .from('purchase_orders')
        .select('id, po_number, status, total, supplier_name, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (poData) setPurchaseOrders(poData);

      // 7. Fetch GRNs
      const { data: grnData } = await supabase
        .from('grns')
        .select('id, grn_number, status, delivery_note_ref, received_at')
        .eq('project_id', projectId)
        .order('received_at', { ascending: false });
      if (grnData) setGrns(grnData);

      // 8. Fetch Client Invoices
      const { data: ciData } = await supabase
        .from('client_invoices')
        .select('id, invoice_number, status, total_incl_vat, invoice_date')
        .eq('project_id', projectId)
        .order('invoice_date', { ascending: false });
      if (ciData) setClientInvoices(ciData || []);

      // 9. Fetch Supplier Invoices
      const { data: siData } = await supabase
        .from('supplier_invoices')
        .select('id, internal_ref, supplier_invoice_number, status, total, supplier_id, invoice_date')
        .eq('project_id', projectId)
        .order('invoice_date', { ascending: false });
      if (siData) setSupplierInvoices(siData || []);

      // 10. Fetch Payments allocated to client invoices
      if (ciData && ciData.length > 0) {
        const ciIds = ciData.map(i => i.id);
        const { data: cPayAllocs } = await supabase
          .from('payment_allocations')
          .select('allocated_amount, client_payments(payment_number, payment_date, amount, method, reference)')
          .in('invoice_id', ciIds);
        
        if (cPayAllocs) {
          const list: any[] = [];
          cPayAllocs.forEach((a: any) => {
            if (a.client_payments) {
              list.push({
                allocated: a.allocated_amount,
                ...a.client_payments
              });
            }
          });
          setClientPayments(list);
        }
      }

      // 11. Fetch Payments allocated to supplier invoices
      if (siData && siData.length > 0) {
        const siIds = siData.map(i => i.id);
        const { data: sPayAllocs } = await supabase
          .from('supplier_payment_allocations')
          .select('allocated_amount, supplier_payments(payment_number, payment_date, amount, method, reference)')
          .in('supplier_invoice_id', siIds);

        if (sPayAllocs) {
          const list: any[] = [];
          sPayAllocs.forEach((a: any) => {
            if (a.supplier_payments) {
              list.push({
                allocated: a.allocated_amount,
                ...a.supplier_payments
              });
            }
          });
          setSupplierPayments(list);
        }
      }

      // 12. Fetch DMS Documents
      const { data: docData } = await supabase
        .from('documents')
        .select('*')
        .eq('entity_type', 'PROJECT')
        .eq('entity_id', projectId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (docData) setDocuments(docData);

    } catch (err: any) {
      console.error('Error loading project files:', err);
      setError(err.message || 'Error collecting project records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjectFile();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)] font-mono text-xs gap-3">
        <div className="animate-spin rounded-full h-5 w-5 border border-[var(--border)] border-t-emerald-400"></div>
        <span>Collecting unified project dossier (Tender through Invoices)...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] p-4 rounded text-xs font-mono flex items-start gap-2">
        <ShieldAlert size={16} className="shrink-0" />
        <div>
          <span>Failed to compile project records: {error}</span>
          <button onClick={() => loadProjectFile()} className="block mt-2 text-[var(--accent)] hover:underline flex items-center gap-1">
            <RefreshCw size={10} /> Retry Aggregation
          </button>
        </div>
      </div>
    );
  }

  // Helper to render tree category container
  const renderFolderSection = (key: string, title: string, count: number, children: React.ReactNode) => {
    const isExpanded = expandedCats[key];
    return (
      <div className="border border-[var(--border)] rounded bg-[var(--bg-card)] overflow-hidden">
        <button
          onClick={() => toggleCat(key)}
          className="w-full flex justify-between items-center bg-[var(--bg-card)] px-4 py-2.5 border-b border-[var(--border)] text-xs font-mono text-[var(--text-secondary)] font-bold hover:bg-[var(--surface-hover)] transition-all text-left"
        >
          <div className="flex items-center gap-2">
            <Folder size={14} className="text-[var(--status-warning-text)] fill-amber-500/10" />
            <span>{title}</span>
            <span className="text-[10px] bg-[var(--surface-hover)] text-[var(--text-muted)] px-1.5 py-0.5 rounded font-normal">
              {count} items
            </span>
          </div>
          <div>
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        </button>
        {isExpanded && (
          <div className="p-4 flex flex-col gap-3.5 bg-[var(--bg-card)]">
            {count === 0 ? (
              <span className="text-[var(--text-muted)] text-[11px] italic font-mono pl-4">No records registered in this stage.</span>
            ) : children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Title Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xs font-mono text-[var(--accent)] uppercase tracking-wider font-bold flex items-center gap-2">
            <Briefcase size={16} /> Unified Project Dossier File
          </h3>
          <span className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5 block">
            Single-source aggregation for master reference: <strong className="text-[var(--text-secondary)]">{projectNumber}</strong>
          </span>
        </div>
        <button
          onClick={loadProjectFile}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1.5 rounded hover:bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--border)] transition-all cursor-pointer text-xs flex items-center gap-1 font-mono"
        >
          <RefreshCw size={12} /> Reload Dossier
        </button>
      </div>

      <div className="flex flex-col gap-4">

        {/* 1. Tendering Stage */}
        {renderFolderSection('TENDERING', '1. Tendering & Estimating', (tender ? 1 : 0) + (boq ? 1 : 0), (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tender && (
              <div className="border border-[var(--border)] bg-[var(--bg-card)] p-3.5 rounded flex flex-col justify-between gap-3 text-xs font-mono">
                <div>
                  <div className="flex items-center gap-1.5 text-[var(--text-secondary)] font-bold uppercase text-[10px]">
                    <Building2 size={12} className="text-purple-400" />
                    <span>Opportunity Tender</span>
                  </div>
                  <h4 className="text-[var(--text-primary)] font-bold mt-1 text-[13px]">{tender.title}</h4>
                  <div className="text-[var(--text-muted)] text-[10px] mt-1">
                    Client: {tender.client_name} • Deadline: {new Date(tender.deadline_date).toLocaleDateString('en-GB')}
                  </div>
                </div>
                <Link href={`/tenders/${tender.id}`} className="text-[var(--accent)] hover:text-[var(--accent)] font-bold text-[10px] flex items-center gap-1 self-start">
                  Open Tender Dashboard <ArrowRight size={10} />
                </Link>
              </div>
            )}

            {boq && (
              <div className="border border-[var(--border)] bg-[var(--bg-card)] p-3.5 rounded flex flex-col justify-between gap-3 text-xs font-mono">
                <div>
                  <div className="flex items-center gap-1.5 text-[var(--text-secondary)] font-bold uppercase text-[10px]">
                    <Layers size={12} className="text-purple-400" />
                    <span>Bill of Quantities (BOQ)</span>
                  </div>
                  <h4 className="text-[var(--text-primary)] font-bold mt-1 text-[13px]">BOQ Final Version {boq.version}</h4>
                  <div className="text-[var(--text-muted)] text-[10px] mt-1">
                    Status: <span className="text-[var(--accent)] font-bold uppercase">{boq.status}</span> • Created: {new Date(boq.created_at).toLocaleDateString('en-GB')}
                  </div>
                </div>
                <Link href={`/pricing`} className="text-[var(--accent)] hover:text-[var(--accent)] font-bold text-[10px] flex items-center gap-1 self-start">
                  Open Estimating BOQ Catalog <ArrowRight size={10} />
                </Link>
              </div>
            )}
          </div>
        ))}

        {/* 2. Client Commercials Stage */}
        {renderFolderSection('COMMERCIAL', '2. Client Quotations & VOs', quotations.length + variationOrders.length, (
          <div className="flex flex-col gap-4 font-mono text-xs">
            {/* Quotations List */}
            {quotations.length > 0 && (
              <div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold block mb-2">Proposal Revisions Chain</span>
                <div className="border border-[var(--border)] rounded overflow-hidden">
                  <table className="w-full text-left bg-[var(--bg-card)] text-[11px]">
                    <thead>
                      <tr className="bg-[var(--bg-card)] text-[var(--text-secondary)] border-b border-[var(--border)] text-[9px] uppercase font-bold">
                        <th className="px-4 py-2">Quote Number</th>
                        <th className="px-4 py-2">Revision</th>
                        <th className="px-4 py-2">Date</th>
                        <th className="px-4 py-2 text-right">Value (Incl. VAT)</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {quotations.map((q) => (
                        <tr key={q.id} className="hover:bg-[var(--surface-hover)]">
                          <td className="px-4 py-2.5 font-bold text-[var(--text-secondary)]">{q.quotation_number}</td>
                          <td className="px-4 py-2.5 text-[var(--text-secondary)]">{q.revision_label}</td>
                          <td className="px-4 py-2.5 text-[var(--text-muted)]">{new Date(q.quotation_date).toLocaleDateString('en-GB')}</td>
                          <td className="px-4 py-2.5 text-right text-[var(--text-primary)]">{fmtAED(q.grand_total_with_vat)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              q.status === 'ACCEPTED' ? 'bg-[var(--accent-glow)] text-[var(--accent)]' :
                              q.status === 'REJECTED' ? 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]' :
                              q.status === 'SENT_TO_CLIENT' ? 'bg-[var(--surface-hover)] text-[var(--accent)]' :
                              'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
                            }`}>{q.status}</span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <Link href={`/quotations/${q.id}`} className="text-[var(--accent)] hover:underline text-[10px]">
                              View Bid Detail &rarr;
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Variation Orders List */}
            {variationOrders.length > 0 && (
              <div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold block mb-2">Approved Variation Orders (VOs)</span>
                <div className="border border-[var(--border)] rounded overflow-hidden">
                  <table className="w-full text-left bg-[var(--bg-card)] text-[11px]">
                    <thead>
                      <tr className="bg-[var(--bg-card)] text-[var(--text-secondary)] border-b border-[var(--border)] text-[9px] uppercase font-bold">
                        <th className="px-4 py-2">VO Reference</th>
                        <th className="px-4 py-2">Approval Date</th>
                        <th className="px-4 py-2 text-right">Selling Cost Impact</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {variationOrders.map((v) => (
                        <tr key={v.id} className="hover:bg-[var(--surface-hover)]">
                          <td className="px-4 py-2.5 font-bold text-[var(--text-secondary)]">{v.vo_number}</td>
                          <td className="px-4 py-2.5 text-[var(--text-muted)]">{v.approval_date ? new Date(v.approval_date).toLocaleDateString('en-GB') : 'PENDING'}</td>
                          <td className="px-4 py-2.5 text-right text-[var(--text-primary)]">{fmtAED(v.total_cost_impact_sell)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              v.status === 'CLIENT_APPROVED' ? 'bg-[var(--accent-glow)] text-[var(--accent)]' :
                              'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
                            }`}>{v.status}</span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <Link href={`/vo`} className="text-[var(--accent)] hover:underline text-[10px]">
                              Open VO Registry &rarr;
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* 3. Procurement Stage */}
        {renderFolderSection('PROCUREMENT', '3. Sourcing & Material Procurement', comparisons.length + purchaseOrders.length + grns.length, (
          <div className="flex flex-col gap-4 font-mono text-xs">
            {/* Comparisons List */}
            {comparisons.length > 0 && (
              <div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold block mb-2">Supplier Bid Comparisons</span>
                <div className="border border-[var(--border)] rounded overflow-hidden">
                  <table className="w-full text-left bg-[var(--bg-card)] text-[11px]">
                    <thead>
                      <tr className="bg-[var(--bg-card)] text-[var(--text-secondary)] border-b border-[var(--border)] text-[9px] uppercase font-bold">
                        <th className="px-4 py-2">Sheet Reference</th>
                        <th className="px-4 py-2">Creation Date</th>
                        <th className="px-4 py-2 text-right">Selected Supplier Cost</th>
                        <th className="px-4 py-2 text-right">Projected Margin</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {comparisons.map((c) => (
                        <tr key={c.id} className="hover:bg-[var(--surface-hover)]">
                          <td className="px-4 py-2.5 font-bold text-[var(--text-secondary)]">{c.comparison_number} (Rev.{c.revision})</td>
                          <td className="px-4 py-2.5 text-[var(--text-muted)]">{new Date(c.comparison_date).toLocaleDateString('en-GB')}</td>
                          <td className="px-4 py-2.5 text-right text-[var(--text-primary)]">{fmtAED(c.total_selected_supplier_cost)}</td>
                          <td className="px-4 py-2.5 text-right text-[var(--accent)]">{c.overall_margin_pct}%</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              c.status === 'APPROVED' ? 'bg-[var(--accent-glow)] text-[var(--accent)]' :
                              'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
                            }`}>{c.status}</span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <Link href={`/procurement/comparisons/${c.id}`} className="text-[var(--accent)] hover:underline text-[10px]">
                              Open Comparison Sheet &rarr;
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Purchase Orders List */}
            {purchaseOrders.length > 0 && (
              <div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold block mb-2">Committed Local Purchase Orders (LPOs)</span>
                <div className="border border-[var(--border)] rounded overflow-hidden">
                  <table className="w-full text-left bg-[var(--bg-card)] text-[11px]">
                    <thead>
                      <tr className="bg-[var(--bg-card)] text-[var(--text-secondary)] border-b border-[var(--border)] text-[9px] uppercase font-bold">
                        <th className="px-4 py-2">PO / LPO Number</th>
                        <th className="px-4 py-2">Supplier Target</th>
                        <th className="px-4 py-2 text-right">Commitment Cost</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {purchaseOrders.map((p) => (
                        <tr key={p.id} className="hover:bg-[var(--surface-hover)]">
                          <td className="px-4 py-2.5 font-bold text-[var(--text-secondary)]">{p.po_number}</td>
                          <td className="px-4 py-2.5 text-[var(--text-secondary)] truncate max-w-[160px]">{p.supplier_name}</td>
                          <td className="px-4 py-2.5 text-right text-[var(--text-primary)]">{fmtAED(p.total)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              p.status === 'APPROVED' || p.status === 'SENT' ? 'bg-[var(--accent-glow)] text-[var(--accent)]' :
                              p.status === 'DELIVERED' || p.status === 'PARTIALLY_DELIVERED' ? 'bg-[var(--surface-hover)] text-[var(--accent)]' :
                              'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
                            }`}>{p.status}</span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <Link href={`/procurement/po/${p.id}`} className="text-[var(--accent)] hover:underline text-[10px]">
                              View LPO Detail &rarr;
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* GRNs List */}
            {grns.length > 0 && (
              <div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold block mb-2">Material Goods Receipt Notes (GRNs)</span>
                <div className="border border-[var(--border)] rounded overflow-hidden">
                  <table className="w-full text-left bg-[var(--bg-card)] text-[11px]">
                    <thead>
                      <tr className="bg-[var(--bg-card)] text-[var(--text-secondary)] border-b border-[var(--border)] text-[9px] uppercase font-bold">
                        <th className="px-4 py-2">GRN Number</th>
                        <th className="px-4 py-2">Delivery Note Reference</th>
                        <th className="px-4 py-2">Receipt Date</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {grns.map((g) => (
                        <tr key={g.id} className="hover:bg-[var(--surface-hover)]">
                          <td className="px-4 py-2.5 font-bold text-[var(--text-secondary)]">{g.grn_number}</td>
                          <td className="px-4 py-2.5 text-[var(--text-secondary)]">{g.delivery_note_ref}</td>
                          <td className="px-4 py-2.5 text-[var(--text-muted)]">{new Date(g.received_at).toLocaleDateString('en-GB')}</td>
                          <td className="px-4 py-2.5">
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[var(--accent-glow)] text-[var(--accent)]">{g.status}</span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <Link href={`/procurement/grn/${g.id}`} className="text-[var(--accent)] hover:underline text-[10px]">
                              Open Receipt &rarr;
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* 4. Financial Stage (Billing & Payments) */}
        {renderFolderSection('FINANCE', '4. Financial Invoicing & Cash Allocation', clientInvoices.length + supplierInvoices.length + clientPayments.length + supplierPayments.length, (
          <div className="flex flex-col gap-4 font-mono text-xs">
            {/* Client Invoices & Receipts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* AR Invoices */}
              <div className="border border-[var(--border)] rounded bg-[var(--bg-card)] p-4">
                <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold block mb-2 flex items-center gap-1">
                  <FileCheck size={12} className="text-[var(--accent)]" />
                  Accounts Receivable (Client Invoices)
                </span>
                {clientInvoices.length === 0 ? (
                  <span className="text-[var(--text-tertiary)] text-[10px] italic">No client progress claims raised.</span>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1">
                    {clientInvoices.map(i => (
                      <div key={i.id} className="flex justify-between items-center bg-[var(--bg-card)] p-2 border border-[var(--border)] rounded text-[11px]">
                        <div>
                          <Link href={`/finance/ar/${i.id}`} className="font-bold text-[var(--text-primary)] hover:underline">
                            {i.invoice_number}
                          </Link>
                          <div className="text-[9px] text-[var(--text-muted)]">{new Date(i.invoice_date).toLocaleDateString('en-GB')}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[var(--text-secondary)] font-semibold">{fmtAED(i.total_incl_vat)}</div>
                          <div className="text-[9px] font-bold text-[var(--accent)] uppercase">{i.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Client Payments */}
              <div className="border border-[var(--border)] rounded bg-[var(--bg-card)] p-4">
                <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold block mb-2 flex items-center gap-1">
                  <DollarSign size={12} className="text-[var(--accent)]" />
                  Received Cash Receipts (Payments)
                </span>
                {clientPayments.length === 0 ? (
                  <span className="text-[var(--text-tertiary)] text-[10px] italic">No payment receipts allocated.</span>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1">
                    {clientPayments.map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-[var(--bg-card)] p-2 border border-[var(--border)] rounded text-[11px]">
                        <div>
                          <span className="font-bold text-[var(--text-primary)]">{p.payment_number}</span>
                          <div className="text-[9px] text-[var(--text-muted)]">
                            {new Date(p.payment_date).toLocaleDateString('en-GB')} • {p.method}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[var(--accent)] font-bold">+{fmtAED(p.allocated)}</div>
                          <div className="text-[9px] text-[var(--text-muted)]">Allocated amount</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Supplier Bills & Disbursements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* AP Invoices */}
              <div className="border border-[var(--border)] rounded bg-[var(--bg-card)] p-4">
                <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold block mb-2 flex items-center gap-1">
                  <FileCheck2 size={12} className="text-[var(--status-warning-text)]" />
                  Accounts Payable (Supplier Bills)
                </span>
                {supplierInvoices.length === 0 ? (
                  <span className="text-[var(--text-tertiary)] text-[10px] italic">No supplier bills registered.</span>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1">
                    {supplierInvoices.map(s => (
                      <div key={s.id} className="flex justify-between items-center bg-[var(--bg-card)] p-2 border border-[var(--border)] rounded text-[11px]">
                        <div>
                          <Link href={`/finance/ap/match/${s.id}`} className="font-bold text-[var(--text-primary)] hover:underline text-[11px]">
                            {s.internal_ref}
                          </Link>
                          <div className="text-[9px] text-[var(--text-muted)]">Invoice: {s.supplier_invoice_number}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[var(--text-secondary)] font-semibold">{fmtAED(s.total)}</div>
                          <div className="text-[9px] font-bold text-[var(--status-warning-text)] uppercase">{s.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Supplier Payments */}
              <div className="border border-[var(--border)] rounded bg-[var(--bg-card)] p-4">
                <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold block mb-2 flex items-center gap-1">
                  <DollarSign size={12} className="text-[var(--status-warning-text)]" />
                  Disbursed Cash Payments
                </span>
                {supplierPayments.length === 0 ? (
                  <span className="text-[var(--text-tertiary)] text-[10px] italic">No vendor payments recorded.</span>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1">
                    {supplierPayments.map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-[var(--bg-card)] p-2 border border-[var(--border)] rounded text-[11px]">
                        <div>
                          <span className="font-bold text-[var(--text-primary)]">{p.payment_number}</span>
                          <div className="text-[9px] text-[var(--text-muted)]">
                            {new Date(p.payment_date).toLocaleDateString('en-GB')} • {p.method}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[var(--status-danger-text)] font-bold">-{fmtAED(p.allocated)}</div>
                          <div className="text-[9px] text-[var(--text-muted)]">Allocated payment</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* 5. DMS Document Tree */}
        {renderFolderSection('DMS', '5. Document Management System (DMS)', documents.length, (
          <div className="border border-[var(--border)] rounded overflow-hidden font-mono text-xs">
            <div className="bg-[var(--bg-card)] px-4 py-2.5 border-b border-[var(--border)] text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wide">
              Folder Structure Tree
            </div>
            <div className="p-4 bg-[var(--bg-card)] flex flex-col gap-3">
              {documents.length === 0 ? (
                <span className="text-[var(--text-muted)] italic text-[11px] pl-4">No documents filed in project directory.</span>
              ) : (
                // Group by Category and Subcategory
                Object.entries(
                  documents.reduce((acc: any, doc: any) => {
                    const cat = doc.category || 'OTHER';
                    const subcat = doc.subcategory || 'UNCLASSIFIED';
                    if (!acc[cat]) acc[cat] = {};
                    if (!acc[cat][subcat]) acc[cat][subcat] = [];
                    acc[cat][subcat].push(doc);
                    return acc;
                  }, {})
                ).map(([cat, subcats]: [string, any]) => (
                  <div key={cat} className="flex flex-col gap-2">
                    {/* Category Folder */}
                    <div className="flex items-center gap-1.5 text-[var(--text-secondary)] font-bold font-sans text-[11px] uppercase">
                      <Folder size={12} className="text-[var(--status-warning-text)] fill-amber-500/10" />
                      <span>{cat.replace('_', ' ')}</span>
                    </div>

                    <div className="pl-4 border-l border-[var(--border)] flex flex-col gap-2.5">
                      {Object.entries(subcats).map(([subcat, docs]: [string, any]) => (
                        <div key={subcat} className="flex flex-col gap-1.5">
                          {/* Subcategory Folder */}
                          <div className="flex items-center gap-1.5 text-[var(--text-secondary)] font-bold font-sans text-[10px] uppercase">
                            <Folder size={11} className="text-[var(--status-warning-text)] fill-amber-500/5" />
                            <span>{subcat.replace('_', ' ')}</span>
                          </div>

                          {/* Files */}
                          <div className="pl-4 border-l border-[var(--border)] flex flex-col gap-1.5">
                            {docs.map((doc: any) => (
                              <div key={doc.id} className="flex justify-between items-center py-1 hover:bg-[var(--surface-hover)] rounded px-1 transition-all">
                                <div className="flex items-center gap-1.5 text-[11px]">
                                  <FileText size={12} className="text-[var(--accent)]" />
                                  <span className="text-[var(--text-primary)] font-semibold">{doc.title}</span>
                                  <span className="text-[9px] text-[var(--text-muted)] font-mono">({doc.original_filename})</span>
                                </div>
                                <div className="flex items-center gap-3 text-[10px]">
                                  <span className="text-[var(--text-muted)]">{(doc.file_size_bytes / 1024).toFixed(0)} KB</span>
                                  <span className={`px-1 rounded text-[8px] font-bold ${
                                    doc.status === 'VERIFIED' ? 'bg-[var(--accent-glow)] text-[var(--accent)]' :
                                    'bg-[var(--surface-hover)] text-[var(--accent)]'
                                  }`}>{doc.status}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}
