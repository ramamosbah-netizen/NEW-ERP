'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { 
  Briefcase, 
  Search, 
  Plus, 
  Calendar, 
  Clock, 
  AlertCircle,
  MapPin,
  DollarSign
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';
import { TanstackDataTable } from '@/components/tables/TanstackDataTable';
import { ColumnDef } from '@tanstack/react-table';

type Tender = {
  id: string;
  title: string;
  project_name: string;
  client_name: string;
  location: string;
  deadline_date: string;
  budget: number | null;
  status: 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Completed';
  updated_at: string;
};

export default function TendersDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Linked BOQ (latest version) and created project per tender
  const [boqMap, setBoqMap] = useState<Record<string, { status: string; total: number; version: number }>>({});
  const [projectMap, setProjectMap] = useState<Record<string, { id: string; number: string | null }>>({});

  useEffect(() => {
    const fetchTenders = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        // 1. Get current authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace('/signin');
          return;
        }

        // 2. Fetch user-scoped tenders
        const { data, error } = await supabase
          .from('tenders')
          .select('id, title, project_name, client_name, location, deadline_date, budget, status, updated_at')
          .order('updated_at', { ascending: false });

        if (error) {
          throw error;
        }

        setTenders(data as Tender[] || []);

        // 3. Enrich with latest BOQ (status + total sell price) and created project
        const tenderIds = (data || []).map((t: any) => t.id);
        if (tenderIds.length > 0) {
          try {
            const [{ data: boqs }, { data: projects }] = await Promise.all([
              supabase.from('boqs').select('tender_id, status, version, financials').in('tender_id', tenderIds),
              supabase.from('projects').select('id, project_number, tender_id').in('tender_id', tenderIds),
            ]);

            const bm: Record<string, { status: string; total: number; version: number }> = {};
            for (const b of (boqs || []) as any[]) {
              const existing = bm[b.tender_id];
              const version = Number(b.version) || 0;
              if (!existing || version > existing.version) {
                bm[b.tender_id] = {
                  status: b.status || 'draft',
                  total: Number(b.financials?.total_selling_price) || 0,
                  version,
                };
              }
            }
            setBoqMap(bm);

            const pm: Record<string, { id: string; number: string | null }> = {};
            for (const p of (projects || []) as any[]) {
              if (p.tender_id && !pm[p.tender_id]) {
                pm[p.tender_id] = { id: p.id, number: p.project_number || null };
              }
            }
            setProjectMap(pm);
          } catch (enrichErr) {
            console.warn('Could not enrich tenders with BOQ/project data:', enrichErr);
          }
        }
      } catch (err: any) {
        console.error('Error fetching tenders:', err);
        setErrorMsg('Failed to load tenders. Ensure the database schemas have been applied.');
      } finally {
        setLoading(false);
      }
    };

    fetchTenders();
  }, [router]);

  // Handle filtering and search
  const filteredTenders = tenders.filter((t) => {
    const matchesSearch = 
      (t.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.client_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.project_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.location || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const formatBudget = (budget: number | null) => {
    if (budget === null || budget === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(budget);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Define column structure for TanstackDataTable
  const columns: ColumnDef<Tender>[] = [
    {
      accessorKey: 'title',
      header: 'Tender Title',
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <Link 
            href={`/tenders/${row.original.id}`}
            className="text-primary hover:text-primary-hover font-bold hover:underline truncate max-w-[280px]"
          >
            {row.original.title}
          </Link>
          <span className="text-[10px] text-text-muted font-mono max-w-[280px] truncate">
            {row.original.project_name || 'No Project Name'}
          </span>
        </div>
      )
    },
    {
      accessorKey: 'client_name',
      header: 'Client Agency',
      cell: ({ getValue }) => <span className="font-semibold text-text-primary">{String(getValue() || '—')}</span>
    },
    {
      accessorKey: 'location',
      header: 'Location / Site',
      cell: ({ getValue }) => (
        <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
          <MapPin size={12} className="text-text-muted shrink-0" />
          <span className="truncate max-w-[150px]">{String(getValue() || '—')}</span>
        </span>
      )
    },
    {
      accessorKey: 'deadline_date',
      header: 'Deadline',
      cell: ({ getValue }) => (
        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-text-secondary">
          <Calendar size={12} className="text-text-muted shrink-0" />
          {formatDate(String(getValue()))}
        </span>
      )
    },
    {
      accessorKey: 'budget',
      header: 'Budget Sum',
      cell: ({ row, getValue }) => {
        const boq = boqMap[row.original.id];
        const fromBoq = !!boq && boq.total > 0;
        const val = fromBoq ? boq.total : (getValue() as number | null);
        return val ? (
          <span className="inline-flex items-center gap-1 font-mono font-bold text-success text-xs" title={fromBoq ? 'Auto-filled from BOQ total selling price' : 'Manually entered budget'}>
            <DollarSign size={12} className="shrink-0" />
            {new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(val)} AED
            {fromBoq && (
              <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-[var(--status-info-bg)] text-[var(--status-info-text)] border border-[var(--status-info-border)]">
                BOQ
              </span>
            )}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        );
      }
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <StatusChip status={String(getValue() || 'Draft')} />
    },
    {
      id: 'boq_project',
      header: 'BOQ / Project',
      cell: ({ row }) => {
        const boq = boqMap[row.original.id];
        const project = projectMap[row.original.id];
        return (
          <div className="flex flex-col gap-1 items-start">
            {boq ? (
              <Link href={`/tenders/${row.original.id}/boq`} onClick={e => e.stopPropagation()} className="no-underline">
                <StatusChip status={boq.status.toUpperCase()} />
              </Link>
            ) : (
              <span className="text-[10px] text-text-muted font-mono">No BOQ</span>
            )}
            {project && (
              <Link
                href={`/projects/${project.id}`}
                onClick={e => e.stopPropagation()}
                className="text-[10px] font-mono font-bold text-primary hover:underline"
                title="Project created from this tender"
              >
                {project.number || `PRJ ${project.id.slice(0, 8)}…`}
              </Link>
            )}
          </div>
        );
      }
    },
    {
      accessorKey: 'updated_at',
      header: 'Last Calibrated',
      cell: ({ getValue }) => (
        <span className="inline-flex items-center gap-1 text-[10px] text-text-muted font-mono">
          <Clock size={10} className="shrink-0" />
          {new Date(String(getValue())).toLocaleDateString()}
        </span>
      )
    }
  ];

  const breadcrumbs = [
    { label: 'COE Cockpit', href: '/dashboard' },
    { label: 'Tenders Registry' }
  ];

  const actions = (
    <Link href="/tenders/new" className="no-underline">
      <Button variant="primary" size="sm" className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
        <Plus size={16} /> New Tender
      </Button>
    </Link>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader 
        title="Tenders & Bid Management" 
        subtitle="Unified register for pre-award commercial bids, cost estimations, and client compliance parameters."
        breadcrumbs={breadcrumbs}
        actions={actions}
      />

      {errorMsg && (
        <div className="flex gap-3 bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-200 text-xs items-start">
          <AlertCircle className="flex-shrink-0 text-red-400 mt-0.5" size={18} />
          <div>
            <strong>Database Connection Error</strong>
            <p className="mt-1 leading-relaxed">{errorMsg}</p>
            <p className="mt-1 leading-relaxed text-[10px] text-red-400/80">
              Ensure the database setup from the original schemas is active and migrated in the Supabase instance.
            </p>
          </div>
        </div>
      )}

      {/* Modern Filter panel & Tanstack Table */}
      <Card className="flex flex-col gap-4" borderAccent="none">
        {/* Controls and Select Filter Row */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 items-stretch sm:items-center">
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-text-muted">
              <Search size={16} />
            </span>
            <input 
              type="text" 
              className="w-full bg-bg-dark border border-border-color rounded-lg pl-9 pr-4 py-2 text-sm text-text-primary placeholder-text-muted outline-none transition-all duration-100 focus:border-border-focus focus:ring-2 focus:ring-primary-glow"
              placeholder="Search by title, client, or site..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <select 
              className="bg-bg-dark border border-border-color hover:border-border-focus rounded-lg px-3 py-2 text-xs font-semibold text-text-secondary outline-none transition-colors cursor-pointer"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Submitted">Submitted</option>
              <option value="Under Review">Under Review</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Empty state fallback or DataTable */}
        {filteredTenders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 text-center py-16 px-4 bg-bg-dark/40 rounded-lg border border-border-color border-dashed">
            <Briefcase size={48} className="text-text-muted opacity-40 animate-pulse" />
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">No Tenders Found</h3>
            <p className="text-xs text-text-muted max-w-[360px] leading-relaxed">
              {searchTerm || statusFilter !== 'all' 
                ? "No pre-award bids match your current search query or filter settings." 
                : "Create your first corporate procurement proposal to initiate bid estimating workflows."}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Link href="/tenders/new" className="no-underline mt-2">
                <Button variant="secondary" size="sm" className="flex items-center gap-1">
                  <Plus size={14} /> Create Tender
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <TanstackDataTable
            columns={columns}
            data={filteredTenders}
            loading={loading}
            emptyText="No matching records in tenders database."
            onRowClick={(row) => router.push(`/tenders/${row.id}`)}
          />
        )}
      </Card>
    </div>
  );
}

