'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Calculator, 
  ArrowLeft, 
  RefreshCw, 
  Check, 
  Lock, 
  Download,
  AlertTriangle,
  Info
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useDepreciationRun } from '@/hooks/useFixedAssets';

export default function DepreciationRunPage() {
  const { runMonthly, exportJournalExcel, loading, error } = useDepreciationRun();
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [scheduleRows, setScheduleRows] = useState<any[]>([]);
  const [fetching, setFetching] = useState(false);

  const fetchScheduledRows = async () => {
    try {
      setFetching(true);
      const pMonth = selectedMonth + '-01';
      
      const { data, error: fetchErr } = await supabase
        .from('depreciation_schedule')
        .select(`
          *,
          fixed_assets:asset_id (
            asset_number,
            name,
            category
          )
        `)
        .eq('period_month', pMonth);

      if (fetchErr) throw fetchErr;
      setScheduleRows(data || []);
    } catch (err) {
      console.error('Error fetching schedule rows:', err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchScheduledRows();
  }, [selectedMonth]);

  const handleRun = async () => {
    const unposted = scheduleRows.filter(r => !r.posted);
    if (unposted.length === 0) {
      alert('All assets for this period are already posted & locked!');
      return;
    }

    try {
      await runMonthly(selectedMonth);
      alert(`Successfully posted depreciation for ${unposted.length} asset(s)!`);
      fetchScheduledRows();
    } catch (err: any) {
      alert(err.message || 'Depreciation run failed');
    }
  };

  const handleExport = async () => {
    const posted = scheduleRows.filter(r => r.posted);
    if (posted.length === 0) {
      alert('No posted depreciation rows found for this period. Run depreciation first!');
      return;
    }

    try {
      await exportJournalExcel(selectedMonth);
    } catch (err: any) {
      alert(err.message || 'Failed to export journal');
    }
  };

  const formatAED = (val: number) => {
    return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(val).replace('AED', '').trim() + ' AED';
  };

  // Determine period lock status
  const isPeriodEmpty = scheduleRows.length === 0;
  const isPeriodLocked = scheduleRows.length > 0 && scheduleRows.every(r => r.posted);
  const totalDeprecationThisMonth = scheduleRows.reduce((sum, r) => sum + Number(r.depreciation_amount), 0);

  return (
    <div className="min-h-screen bg-[#060814] text-[#f8fafc]">
<main className="max-w-[1600px] mx-auto px-6 py-8">
        
        {/* BACK */}
        <Link href="/assets" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 mb-6 font-semibold">
          <ArrowLeft size={13} /> Back to Asset Register
        </Link>

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-900 pb-6 mb-8 gap-4">
          <div>
            <h1 className="font-heading font-extrabold text-2xl tracking-tight text-slate-100 flex items-center gap-2">
              <Calculator size={24} className="text-[var(--primary)]" />
              Depreciation Running Cockpit
            </h1>
            <p className="text-xs text-[#94a3b8] mt-1 uppercase tracking-widest font-mono">
              Execute monthly straight-line runs, lock accounting periods & generate double-entry journals
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-mono">Run Period Month:</span>
              <input 
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-slate-200 px-3 py-1.5 rounded-lg focus:outline-none focus:border-[var(--primary)] text-xs font-mono"
              />
            </div>
            
            <button
              onClick={fetchScheduledRows}
              className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-all"
              title="Reload schedule"
            >
              <RefreshCw size={15} className={fetching ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* PERIOD SUMMARY BANNER */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          
          {/* Status card */}
          <div className="p-5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">Period Lock Status</span>
              <div className="text-lg font-heading font-bold text-slate-100 mt-2 flex items-center gap-2">
                {isPeriodEmpty ? (
                  <span className="text-slate-500">No Assets Scheduled</span>
                ) : isPeriodLocked ? (
                  <>
                    <Lock size={16} className="text-emerald-400" />
                    <span className="text-emerald-400 font-mono">LOCKED & POSTED</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={16} className="text-amber-400" />
                    <span className="text-amber-400 font-mono">DRAFT / UNPOSTED</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Running totals */}
          <div className="p-5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block">Period Depreciation Amount</span>
            <div className="text-2xl font-heading font-bold text-slate-100 mt-2 font-mono">
              {formatAED(totalDeprecationThisMonth)}
            </div>
          </div>

          {/* Action buttons */}
          <div className="p-5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl flex items-center justify-end gap-3">
            <button
              onClick={handleExport}
              disabled={isPeriodEmpty || !isPeriodLocked}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-lg font-mono transition-all ${
                isPeriodLocked
                  ? 'bg-slate-900 border border-slate-800 text-slate-200 hover:bg-slate-800'
                  : 'bg-slate-950 border border-slate-900 text-slate-700 cursor-not-allowed'
              }`}
            >
              <Download size={14} />
              Export Excel Journal
            </button>

            <button
              onClick={handleRun}
              disabled={isPeriodEmpty || isPeriodLocked || loading}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-lg font-mono transition-all ${
                isPeriodEmpty || isPeriodLocked
                  ? 'bg-slate-950 border border-slate-900 text-slate-700 cursor-not-allowed'
                  : 'bg-[var(--primary)] text-slate-950 hover:bg-[var(--primary-hover)] shadow-[0_0_15px_rgba(0,229,160,0.15)]'
              }`}
            >
              <Check size={14} />
              {loading ? 'Posting...' : 'Post & Lock Period'}
            </button>
          </div>
        </div>

        {/* SCHEDULE PREVIEW TABLE */}
        <div className="p-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl">
          <h3 className="font-heading font-extrabold text-sm uppercase tracking-wider text-slate-200 mb-6">
            Depreciation Schedule Line Items for {new Date(selectedMonth + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </h3>

          {fetching ? (
            <div className="h-60 flex items-center justify-center text-xs font-mono text-slate-500">
              <RefreshCw className="animate-spin mr-2" size={15} /> Fetching period schedule...
            </div>
          ) : scheduleRows.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-xs font-mono text-slate-500 border border-dashed border-slate-900 rounded-lg">
              No assets scheduled for depreciation in this month.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                    <th className="pb-3">Asset Number</th>
                    <th className="pb-3">Asset Name</th>
                    <th className="pb-3">Category</th>
                    <th className="pb-3">Opening NBV</th>
                    <th className="pb-3">Monthly Depreciation</th>
                    <th className="pb-3">Closing NBV</th>
                    <th className="pb-3">Accumulated Dep.</th>
                    <th className="pb-3 text-right">Posting Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-950/40 text-xs font-mono">
                  {scheduleRows.map(row => (
                    <tr key={row.id} className="hover:bg-slate-900/10">
                      <td className="py-4 font-bold text-[var(--primary)]">
                        <Link href={`/assets/${row.asset_id}`} className="hover:underline">
                          {row.fixed_assets?.asset_number}
                        </Link>
                      </td>
                      <td className="py-4 font-sans font-bold text-slate-200">
                        {row.fixed_assets?.name}
                      </td>
                      <td className="py-4 text-[10px] text-slate-500 uppercase">
                        {row.fixed_assets?.category.replace(/_/g, ' ')}
                      </td>
                      <td className="py-4 text-slate-400">{formatAED(row.opening_nbv)}</td>
                      <td className="py-4 text-amber-500 font-bold">{formatAED(row.depreciation_amount)}</td>
                      <td className="py-4 text-slate-300">{formatAED(row.closing_nbv)}</td>
                      <td className="py-4 text-slate-400">{formatAED(row.accumulated)}</td>
                      <td className="py-4 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] uppercase font-bold border ${
                          row.posted
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-900 text-slate-500 border-slate-800'
                        }`}>
                          {row.posted ? 'Locked & Posted' : 'Draft'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
