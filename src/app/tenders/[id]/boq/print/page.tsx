'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Printer, AlertCircle } from 'lucide-react';
import '@/app/tenders/tenders.css';

type BOQItem = {
  name: string;
  quantity: number;
  material_unit_cost: number;
  wastage_pct: number;
  labor_unit_cost: number;
  transport_unit_cost: number;
  overhead_pct: number;
  profit_pct: number;
  material_total_cost: number;
  wastage_cost: number;
  labor_total_cost: number;
  transport_total_cost: number;
  overhead_cost: number;
  profit_value: number;
  unit_price: number;
  total_price: number;
};

type ApprovalLog = {
  stage: string;
  approved_by: string;
  email: string;
  approved_at: string;
  note: string;
};

type BOQ = {
  id: string;
  status: string;
  version: number;
  items: BOQItem[];
  cost_elements: any;
  financials: any;
  approval_history: ApprovalLog[];
  created_at: string;
};

export default function BOQPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const tenderId = resolvedParams.id;

  const [loading, setLoading] = useState(true);
  const [tender, setTender] = useState<any>(null);
  const [boq, setBoq] = useState<BOQ | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrintData = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        // 1. Get user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          router.replace('/signin');
          return;
        }

        // 2. Fetch Tender status
        const { data: tenderData, error: tenderError } = await supabase
          .from('tenders')
          .select('id, title, project_name, client_name, location')
          .eq('id', tenderId)
          .single();

        if (tenderError) throw tenderError;
        setTender(tenderData);

        // 3. Fetch BOQ
        const { data: boqData, error: boqError } = await supabase
          .from('boqs')
          .select('*')
          .eq('tender_id', tenderId)
          .single();

        if (boqError || !boqData) {
          throw new Error('BOQ Costing Sheet not found for this tender.');
        }

        setBoq(boqData as BOQ);

        // 4. Trigger print after render cycle
        setTimeout(() => {
          window.print();
        }, 800);

      } catch (err: any) {
        console.error('Error loading print page data:', err);
        setErrorMsg(err.message || 'Error retrieving BOQ data.');
      } finally {
        setLoading(false);
      }
    };

    fetchPrintData();
  }, [tenderId, router]);

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner"></div>
        <p style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-secondary)' }}>Preparing Print Report Document...</p>
      </div>
    );
  }

  if (errorMsg || !tender || !boq) {
    return (
      <div className="tenders-container">
        <div className="tenders-header">
          <Link href={`/tenders/${tenderId}/boq`} className="logout-btn" style={{ textDecoration: 'none', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeft size={14} /> Back to BOQ
          </Link>
        </div>
        <div className="db-warning-banner" style={{ border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', marginTop: '2rem' }}>
          <AlertCircle size={24} style={{ color: 'var(--error)' }} />
          <div>
            <strong>Report Generation Blocked</strong>
            <p style={{ marginTop: '0.4rem' }}>{errorMsg || 'Unable to retrieve document.'}</p>
          </div>
        </div>
      </div>
    );
  }

  // Find signatures in approval history
  const getSignature = (stageKey: string) => {
    const log = boq.approval_history?.find(h => h.stage === stageKey);
    if (log) {
      return {
        signed: true,
        by: log.approved_by,
        at: new Date(log.approved_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      };
    }
    return { signed: false, by: 'Signature Pending', at: '' };
  };

  const techSig = getSignature('submitted') || getSignature('engineer_approved');
  const engSig = getSignature('engineer_approved');
  const mgrSig = getSignature('manager_approved');
  const finSig = getSignature('finance_approved');

  // Math variables
  const itemsList = boq.items || [];
  const fin = boq.financials || {};
  const ce = boq.cost_elements || {};

  const supplySubtotal = itemsList.reduce((acc, item) => acc + ((item as any).material_total_cost || item.total_price || 0), 0);

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', padding: '20px', background: '#ffffff', color: '#000000', fontFamily: 'sans-serif' }}>
      
      {/* Action panel (hidden on actual print) */}
      <div className="action-btn-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
        <Link 
          href={`/tenders/${tenderId}/boq`} 
          className="action-btn btn-secondary" 
          style={{ textDecoration: 'none', padding: '0.5rem 1rem', fontSize: '0.85rem', color: '#1e293b', border: '1px solid #cbd5e1', background: '#f8fafc' }}
        >
          <ArrowLeft size={14} /> Back to Details
        </Link>
        <button 
          onClick={() => window.print()} 
          className="action-btn btn-primary"
          style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', background: '#2563eb', color: '#ffffff' }}
        >
          <Printer size={14} /> Print Document
        </button>
      </div>

      {/* Corporate Letterhead Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px double #000000', paddingBottom: '15px', marginBottom: '25px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 5px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>
            JEET MEP ENTERPRISES
          </h1>
          <p style={{ margin: '0 0 3px 0', fontSize: '12px', color: '#475569' }}>
            ERP Costing & Project Estimations Division
          </p>
          <p style={{ margin: '0', fontSize: '11px', color: '#64748b' }}>
            Main Corporate HQ • Phone: +971-000-0000 • contact@jeetmep.com
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#2563eb', margin: '0 0 5px 0' }}>
            BOQ COSTING REPORT
          </h2>
          <p style={{ margin: '0 0 3px 0', fontSize: '12px', fontWeight: 'bold' }}>
            BOQ ID: {boq.id.substring(0, 8).toUpperCase()}
          </p>
          <p style={{ margin: '0', fontSize: '11px', color: '#475569' }}>
            Date: {new Date(boq.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Project Meta Information */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px', padding: '15px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
        <div>
          <h3 style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', margin: '0 0 8px 0', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
            Tender Details
          </h3>
          <p style={{ margin: '0 0 5px 0', fontSize: '13px' }}>
            <strong>Tender Title:</strong> {tender.title}
          </p>
          <p style={{ margin: '0 0 5px 0', fontSize: '13px' }}>
            <strong>Project Name:</strong> {tender.project_name}
          </p>
          <p style={{ margin: '0', fontSize: '13px' }}>
            <strong>Client / Agency:</strong> {tender.client_name}
          </p>
        </div>
        <div>
          <h3 style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', margin: '0 0 8px 0', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
            BOQ Version Control & Status
          </h3>
          <p style={{ margin: '0 0 5px 0', fontSize: '13px' }}>
            <strong>Current Revision:</strong> Revision {boq.version}
          </p>
          <p style={{ margin: '0 0 5px 0', fontSize: '13px', textTransform: 'uppercase' }}>
            <strong>Authorization Status:</strong> <span style={{ color: boq.status === 'finalized' ? '#16a34a' : '#2563eb', fontWeight: 'bold' }}>{boq.status}</span>
          </p>
          <p style={{ margin: '0', fontSize: '13px' }}>
            <strong>Project Location:</strong> {tender.location}
          </p>
        </div>
      </div>

      {/* Items Table */}
      <h3 style={{ fontSize: '14px', textTransform: 'uppercase', margin: '0 0 10px 0', borderBottom: '1px solid #000000', paddingBottom: '5px' }}>
        Itemized Cost breakdown
      </h3>
      
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px', fontSize: '11px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #000000', background: '#f1f5f9' }}>
            <th style={{ padding: '6px 4px', textAlign: 'left', width: '30px' }}>No.</th>
            <th style={{ padding: '6px 4px', textAlign: 'left' }}>Item Description</th>
            <th style={{ padding: '6px 4px', textAlign: 'center', width: '50px' }}>Qty</th>
            <th style={{ padding: '6px 4px', textAlign: 'right', width: '80px' }}>Mat. Unit</th>
            <th style={{ padding: '6px 4px', textAlign: 'right', width: '70px' }}>Wast. %</th>
            <th style={{ padding: '6px 4px', textAlign: 'right', width: '70px' }}>Labor/U</th>
            <th style={{ padding: '6px 4px', textAlign: 'right', width: '70px' }}>Trans/U</th>
            <th style={{ padding: '6px 4px', textAlign: 'right', width: '70px' }}>Over. %</th>
            <th style={{ padding: '6px 4px', textAlign: 'right', width: '70px' }}>Prof. %</th>
            <th style={{ padding: '6px 4px', textAlign: 'right', width: '80px' }}>Unit Sell</th>
            <th style={{ padding: '6px 4px', textAlign: 'right', width: '90px' }}>Total Sell</th>
          </tr>
        </thead>
        <tbody>
          {itemsList.map((item, index) => (
            <tr key={index} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '6px 4px' }}>{index + 1}</td>
              <td style={{ padding: '6px 4px', fontWeight: 'bold' }}>{item.name}</td>
              <td style={{ padding: '6px 4px', textAlign: 'center' }}>{item.quantity ?? (item as any).qty}</td>
              <td style={{ padding: '6px 4px', textAlign: 'right' }}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((item as any).material_unit_cost || item.unit_price || 0)}
              </td>
              <td style={{ padding: '6px 4px', textAlign: 'right' }}>{(item as any).wastage_pct || 0}%</td>
              <td style={{ padding: '6px 4px', textAlign: 'right' }}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((item as any).labor_unit_cost || 0)}
              </td>
              <td style={{ padding: '6px 4px', textAlign: 'right' }}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((item as any).transport_unit_cost || 0)}
              </td>
              <td style={{ padding: '6px 4px', textAlign: 'right' }}>{(item as any).overhead_pct || 0}%</td>
              <td style={{ padding: '6px 4px', textAlign: 'right' }}>{(item as any).profit_pct || 0}%</td>
              <td style={{ padding: '6px 4px', textAlign: 'right', color: '#475569' }}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.unit_price || 0)}
              </td>
              <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 'bold' }}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.total_price || 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Financial Calculations Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '40px', marginBottom: '35px', pageBreakInside: 'avoid' }}>
        
        {/* Left Side: Cost elements */}
        <div>
          <h4 style={{ fontSize: '12px', textTransform: 'uppercase', margin: '0 0 10px 0', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px' }}>
            Cost Estimations Drivers
          </h4>
          <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '5px 0', color: '#475569' }}>Material Supply Subtotal</td>
                <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 'bold' }}>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(supplySubtotal)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '5px 0', color: '#475569' }}>Total Material Wastage Cost</td>
                <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 'bold' }}>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(fin.wastage_value || 0)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '5px 0', color: '#475569' }}>Total Freight & Logistics Cost</td>
                <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 'bold' }}>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(fin.logistics_cost || 0)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '5px 0', color: '#475569' }}>Total Labor Cost Breakdown</td>
                <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 'bold' }}>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(fin.labor_total || 0)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '5px 0', color: '#475569' }}>Total Overhead Allowance</td>
                <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 'bold' }}>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(fin.overhead_value || 0)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '5px 0', color: '#475569' }}>Global Equipment rentals</td>
                <td style={{ padding: '5px 0', textAlign: 'right' }}>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(ce.equipment_cost || fin.equipment_cost || 0)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '5px 0', color: '#475569' }}>Global Subcontracting outlay</td>
                <td style={{ padding: '5px 0', textAlign: 'right' }}>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(ce.subcontract_cost || fin.subcontract_cost || 0)}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '5px 0', color: '#475569' }}>Global Contingency Risk buffer</td>
                <td style={{ padding: '5px 0', textAlign: 'right' }}>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(ce.risk_cost || fin.risk_cost || 0)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '5px 0', color: '#475569' }}>Site factor Multiplier</td>
                <td style={{ padding: '5px 0', textAlign: 'right' }}>{fin.site_factor || 1}x</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Right Side: Totals */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
          <h4 style={{ fontSize: '12px', textTransform: 'uppercase', margin: '0 0 10px 0', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px' }}>
            Final Bid Valuation
          </h4>
          <div style={{ background: '#f8fafc', padding: '15px', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px', color: '#475569' }}>
              <span>Total Direct Costs:</span>
              <span style={{ fontWeight: 'bold' }}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(fin.direct_total || 0)}
              </span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px', color: '#475569' }}>
              <span>Total Indirect Costs:</span>
              <span style={{ fontWeight: 'bold' }}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(fin.indirect_total || 0)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px', borderTop: '1px dashed #cbd5e1', paddingTop: '8px', color: '#475569' }}>
              <span>Pre-Profit Cost:</span>
              <span>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                  ((fin.direct_total || 0) + (fin.indirect_total || 0)) * (fin.site_factor || 1.0)
                )}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '12px', color: '#475569' }}>
              <span>Profit Margin ({fin.profit_pct || 0}%):</span>
              <span>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(fin.profit_value || 0)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 'bold', borderTop: '2px solid #000000', paddingTop: '10px' }}>
              <span>Total Selling Price:</span>
              <span style={{ color: '#2563eb' }}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(fin.total_selling_price || 0)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '10px', color: '#64748b' }}>
              <span>Average Unit selling price:</span>
              <span>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(fin.unit_selling_price || 0)} / item
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Signature Authorization Block */}
      <div style={{ pageBreakInside: 'avoid', marginTop: '40px' }}>
        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', margin: '0 0 15px 0', borderBottom: '1px solid #000000', paddingBottom: '5px', fontWeight: 'bold' }}>
          System Sign-Off & Approvals
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', fontSize: '11px' }}>
          
          {/* Engineering Sign-off */}
          <div style={{ border: '1px solid #cbd5e1', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
            <p style={{ fontWeight: 'bold', margin: '0 0 15px 0', textTransform: 'uppercase', color: '#475569', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
              Technical Approver
            </p>
            {engSig.signed ? (
              <div>
                <p style={{ margin: '0 0 3px 0', fontWeight: 'bold', color: '#16a34a' }}>✓ SECURELY SIGNED</p>
                <p style={{ margin: '0 0 3px 0', color: '#1e293b' }}>{engSig.by}</p>
                <p style={{ margin: '0', color: '#64748b', fontSize: '10px' }}>Date: {engSig.at}</p>
              </div>
            ) : (
              <div>
                <p style={{ margin: '0 0 3px 0', fontWeight: 'bold', color: '#94a3b8' }}>PENDING SIGNATURE</p>
                <p style={{ margin: '0', color: '#94a3b8', fontStyle: 'italic' }}>Sequential Step 2</p>
              </div>
            )}
          </div>

          {/* Manager Sign-off */}
          <div style={{ border: '1px solid #cbd5e1', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
            <p style={{ fontWeight: 'bold', margin: '0 0 15px 0', textTransform: 'uppercase', color: '#475569', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
              Cost Validation
            </p>
            {mgrSig.signed ? (
              <div>
                <p style={{ margin: '0 0 3px 0', fontWeight: 'bold', color: '#16a34a' }}>✓ SECURELY SIGNED</p>
                <p style={{ margin: '0 0 3px 0', color: '#1e293b' }}>{mgrSig.by}</p>
                <p style={{ margin: '0', color: '#64748b', fontSize: '10px' }}>Date: {mgrSig.at}</p>
              </div>
            ) : (
              <div>
                <p style={{ margin: '0 0 3px 0', fontWeight: 'bold', color: '#94a3b8' }}>PENDING SIGNATURE</p>
                <p style={{ margin: '0', color: '#94a3b8', fontStyle: 'italic' }}>Sequential Step 3</p>
              </div>
            )}
          </div>

          {/* Finance Sign-off */}
          <div style={{ border: '1px solid #cbd5e1', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>
            <p style={{ fontWeight: 'bold', margin: '0 0 15px 0', textTransform: 'uppercase', color: '#475569', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
              Finance Approval
            </p>
            {finSig.signed ? (
              <div>
                <p style={{ margin: '0 0 3px 0', fontWeight: 'bold', color: '#16a34a' }}>✓ SECURELY SIGNED</p>
                <p style={{ margin: '0 0 3px 0', color: '#1e293b' }}>{finSig.by}</p>
                <p style={{ margin: '0', color: '#64748b', fontSize: '10px' }}>Date: {finSig.at}</p>
              </div>
            ) : (
              <div>
                <p style={{ margin: '0 0 3px 0', fontWeight: 'bold', color: '#94a3b8' }}>PENDING SIGNATURE</p>
                <p style={{ margin: '0', color: '#94a3b8', fontStyle: 'italic' }}>Sequential Step 4</p>
              </div>
            )}
          </div>

        </div>
        
        <div style={{ marginTop: '20px', fontSize: '10px', color: '#64748b', textAlign: 'center' }}>
          This costing report is digitally signed and audited inside the ERP Tender Database. Generated using Revision {boq.version}.
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .action-btn-row {
            display: none !important;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
        }
      `}</style>

    </div>
  );
}
