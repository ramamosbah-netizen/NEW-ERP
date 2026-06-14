'use client';

// ============================================================
// JEET ERP — Project Document Register
// Shows every document linked to a project (tender → BOQ →
// quotation → comparisons → LPOs → GRNs → invoices → files),
// each traced to the project id with its own reference and a
// review link.
// ============================================================

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import projectDocumentService, { ProjectLinkedRegister } from '@/services/projectDocumentService';
import { StatusChip } from '@/components/ui/StatusChip';
import { ExternalLink, Layers, FileText, Hash, Scale, ShoppingCart, PackageCheck, ArrowUpRight, ArrowDownLeft, FileSignature, Paperclip } from 'lucide-react';

const CATEGORY_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'Tender': FileText,
  'BOQ': Hash,
  'Quotation': FileText,
  'Comparison': Scale,
  'Purchase Order (LPO)': ShoppingCart,
  'Supplier Proforma': FileSignature,
  'Goods Receipt': PackageCheck,
  'Client Invoice': ArrowUpRight,
  'Supplier Invoice': ArrowDownLeft,
  'Client LPO / Contract': FileSignature,
  'Attached File': Paperclip,
};

interface Props {
  project: {
    id: string;
    project_number?: string;
    tender_id?: string | null;
    boq_id?: string | null;
    quotation_id?: string | null;
  };
}

const fmtAED = (v?: number | null) =>
  v == null ? '' : new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(v) + ' AED';

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

export const ProjectDocumentRegister: React.FC<Props> = ({ project }) => {
  const [register, setRegister] = useState<ProjectLinkedRegister | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    projectDocumentService.getLinkedRegister(project)
      .then(r => { if (!cancelled) setRegister(r); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [project]);

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <div className="h-7 w-7 rounded-full border-2 border-[var(--border-color)] border-t-[var(--text-primary)] animate-spin" />
      </div>
    );
  }

  if (!register || register.totalCount === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-[var(--text-muted)]">
        <Layers size={28} className="opacity-30" />
        <p className="text-sm">No linked documents found for this project yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Lineage banner */}
      <div className="flex items-center gap-2 flex-wrap bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-lg px-4 py-3">
        <Layers size={15} className="text-[var(--text-secondary)]" />
        <span className="text-xs text-[var(--text-secondary)]">
          <strong className="text-[var(--text-primary)] font-mono">{register.project.project_number || 'This project'}</strong>
          {' '}— {register.totalCount} linked document{register.totalCount === 1 ? '' : 's'} traced across the full lifecycle
        </span>
      </div>

      {register.groups.map(group => {
        const Icon = CATEGORY_ICON[group.category] || FileText;
        return (
          <div key={group.category} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border-color)] bg-[var(--bg-card-hover)]">
              <Icon size={14} className="text-[var(--text-secondary)]" />
              <span className="text-xs font-medium text-[var(--text-primary)]">{group.category}</span>
              <span className="text-[0.6875rem] text-[var(--text-muted)] font-mono">({group.items.length})</span>
            </div>
            <div className="divide-y divide-[var(--border-color)]">
              {group.items.map((item, idx) => {
                const row = (
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-[var(--bg-card-hover)] transition-colors">
                    <div className="min-w-0 flex items-center gap-3">
                      <span className="text-xs font-medium text-[var(--text-primary)] truncate">{item.reference}</span>
                      {item.status && <StatusChip status={String(item.status).toUpperCase()} />}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {item.amount != null && (
                        <span className="text-xs font-mono text-[var(--text-secondary)]">{fmtAED(item.amount)}</span>
                      )}
                      {item.date && (
                        <span className="text-[0.6875rem] text-[var(--text-muted)] font-mono hidden sm:inline">{fmtDate(item.date)}</span>
                      )}
                      {item.href && <ExternalLink size={13} className="text-[var(--text-muted)]" />}
                    </div>
                  </div>
                );
                return item.href ? (
                  <Link key={idx} href={item.href} className="block no-underline">{row}</Link>
                ) : (
                  <div key={idx}>{row}</div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProjectDocumentRegister;
