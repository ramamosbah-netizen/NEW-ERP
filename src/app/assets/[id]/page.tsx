'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Calculator, 
  Trash2, 
  DollarSign, 
  Calendar, 
  User, 
  MapPin, 
  FileText,
  AlertTriangle,
  RefreshCw,
  TrendingDown
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAsset } from '@/hooks/useFixedAssets';

export default function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const assetId = resolvedParams.id;
  const { asset, schedule, loading, error, refetch, disposeAsset } = useAsset(assetId);

  const [showDisposalModal, setShowDisposalModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [disposalForm, setDisposalForm] = useState({
    disposal_date: new Date().toISOString().substring(0, 10),
    method: 'SALE' as any,
    proceeds: 0,
    buyer: '',
    notes: ''
  });

  const [disposalDetails, setDisposalDetails] = useState<any | null>(null);

  const fetchDisposalDetails = async () => {
    if (!assetId) return;
    const { data } = await supabase
      .from('asset_disposals')
      .select('*')
      .eq('asset_id', assetId)
      .maybeSingle();
    
    if (data) {
      setDisposalDetails(data);
    }
  };

  useEffect(() => {
    if (asset && asset.status === 'DISPOSED') {
      fetchDisposalDetails();
    }
  }, [asset]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text-primary)] flex items-center justify-center font-mono text-xs">
        Loading asset ledger...
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text-primary)] flex flex-col items-center justify-center gap-4">
        <span className="text-xs font-mono text-[var(--text-primary)]0">Asset record not found.</span>
        <Link href="/assets" className="text-xs text-[var(--primary)] font-bold flex items-center gap-1.5">
          <ArrowLeft size={14} /> Back to Register
        </Link>
      </div>
    );
  }

  const handleDisposalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await disposeAsset(disposalForm);
      setShowDisposalModal(false);
      alert('Asset disposal recorded successfully!');
      refetch();
      fetchDisposalDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to dispose asset');
    } finally {
      setSubmitting(false);
    }
  };

  const formatAED = (val: number) => {
    return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(val).replace('AED', '').trim() + ' AED';
  };

  // Find remaining unposted monthly charges
  const pendingMonths = schedule.filter(r => !r.posted).length;

  return (
    <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text-primary)]">
<main className="max-w-[1600px] mx-auto px-6 py-8">
        
        {/* BACK */}
        <Link href="/assets" className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-6 font-semibold">
          <ArrowLeft size={13} /> Back to Asset Register
        </Link>

        {/* WORKSPACE HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[var(--border)] pb-6 mb-8 gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)] shadow-[0_0_20px_var(--accent-glow)]">
              <Calculator size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-extrabold text-xl text-[var(--text-primary)] uppercase">
                  {asset.asset_number}
                </span>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${
                  asset.status === 'ACTIVE'
                    ? 'bg-[var(--accent-glow)] text-[var(--accent)] border-[var(--accent)]'
                    : asset.status === 'FULLY_DEPRECIATED'
                    ? 'bg-[var(--surface-hover)] text-[var(--accent)] border-[var(--border)]'
                    : 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]'
                }`}>
                  {asset.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1.5 font-mono">
                {asset.name} • Category: <span className="text-[var(--text-primary)] font-semibold">{asset.category}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {asset.status !== 'DISPOSED' && asset.status !== 'WRITTEN_OFF' && (
              <button 
                onClick={() => setShowDisposalModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)] rounded-lg font-mono transition-all"
              >
                <Trash2 size={14} />
                Retire / Dispose Asset
              </button>
            )}
          </div>
        </div>

        {/* DETAILS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          
          {/* Left Panel: Specifications */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            
            {/* Core asset spec */}
            <div className="p-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl flex flex-col gap-5">
              <h3 className="font-heading font-bold text-xs uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)] pb-3">
                Capitalization Details
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-[10px] text-[var(--text-primary)]0 uppercase font-mono">Acquisition Cost</span>
                  <span className="text-xs text-[var(--text-primary)] font-mono font-bold mt-1 block">
                    {formatAED(asset.acquisition_cost)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-[var(--text-primary)]0 uppercase font-mono">Salvage Value</span>
                  <span className="text-xs text-[var(--text-primary)] font-mono font-bold mt-1 block">
                    {formatAED(asset.salvage_value)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-[var(--text-primary)]0 uppercase font-mono">Useful Life</span>
                  <span className="text-xs text-[var(--text-primary)] font-mono mt-1 block">
                    {asset.useful_life_months} months
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-[var(--text-primary)]0 uppercase font-mono">Acquisition Date</span>
                  <span className="text-xs text-[var(--text-primary)] font-mono mt-1 block">
                    {new Date(asset.acquisition_date).toLocaleDateString('en-GB')}
                  </span>
                </div>
              </div>

              <div className="border-t border-[var(--border)] pt-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <User size={13} className="text-[var(--text-primary)]0" />
                  <span className="text-[var(--text-secondary)]">Custodian: {asset.custodian_name || 'Unassigned'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <MapPin size={13} className="text-[var(--text-primary)]0" />
                  <span className="text-[var(--text-secondary)]">Location: {asset.location || 'Head Office'}</span>
                </div>
              </div>
            </div>

            {/* Links and warnings sync box */}
            <div className="p-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl flex flex-col gap-5">
              <h3 className="font-heading font-bold text-xs uppercase tracking-widest text-[var(--text-secondary)] border-b border-[var(--border)] pb-3">
                ERP System Bindings
              </h3>
              {asset.linked_vehicle_id ? (
                <div className="p-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg flex flex-col gap-2 text-xs">
                  <span className="text-[10px] text-[var(--text-primary)]0 uppercase font-mono block">Linked Vehicle Profile</span>
                  <Link 
                    href={`/fleet/${asset.linked_vehicle_id}`}
                    className="text-[var(--primary)] font-bold hover:underline font-mono"
                  >
                    Vehicle: {asset.vehicle_code || 'View details'}
                  </Link>
                  <span className="text-[10px] text-[var(--text-primary)]0 font-mono block mt-1">
                    Notice: Disposing this asset will sync the vehicle status to SOLD/DISPOSED automatically.
                  </span>
                </div>
              ) : (
                <div className="text-xs text-[var(--text-primary)]0 font-mono italic">
                  No linked vehicle or high-value tool integrations. Standalone capitalized asset.
                </div>
              )}
            </div>

            {/* DISPOSAL INFO BOX */}
            {asset.status === 'DISPOSED' && disposalDetails && (
              <div className="p-6 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-xl flex flex-col gap-4">
                <h3 className="font-heading font-bold text-xs uppercase tracking-widest text-[var(--status-danger-text)] border-b border-[var(--status-danger-border)] pb-3 flex items-center gap-1.5">
                  <TrendingDown size={14} />
                  Asset Disposal Audit Log
                </h3>
                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <span className="block text-[10px] text-[var(--text-primary)]0 uppercase">Disposal Date</span>
                    <span className="text-[var(--text-secondary)] font-semibold block mt-0.5">
                      {new Date(disposalDetails.disposal_date).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-[var(--text-primary)]0 uppercase">Disposal Method</span>
                    <span className="text-[var(--text-secondary)] font-semibold block mt-0.5">{disposalDetails.method}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-[var(--text-primary)]0 uppercase">Proceeds (AED)</span>
                    <span className="text-[var(--text-secondary)] font-semibold block mt-0.5">
                      {formatAED(disposalDetails.proceeds)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-[var(--text-primary)]0 uppercase">Gain / Loss (AED)</span>
                    <span className={`font-bold block mt-0.5 ${Number(disposalDetails.gain_loss) >= 0 ? 'text-[var(--accent)]' : 'text-[var(--status-danger-text)]'}`}>
                      {formatAED(disposalDetails.gain_loss)}
                    </span>
                  </div>
                </div>
                {disposalDetails.notes && (
                  <div className="text-[11px] text-[var(--text-secondary)] border-t border-[var(--status-danger-border)] pt-3">
                    <span className="font-semibold block text-[var(--text-primary)]0 mb-1">Notes:</span>
                    {disposalDetails.notes}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Panel: Depreciation schedule list */}
          <div className="lg:col-span-2 p-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl flex flex-col h-[520px]">
            <div className="flex justify-between items-center mb-6 border-b border-[var(--border)] pb-3">
              <h3 className="font-heading font-bold text-xs uppercase tracking-widest text-[var(--text-primary)]">
                Amortization Depreciation Schedule ({schedule.length} periods)
              </h3>
              {asset.status === 'ACTIVE' && (
                <span className="text-[10px] font-mono text-[var(--text-primary)]0">
                  {pendingMonths} periods remaining
                </span>
              )}
            </div>

            <div className="overflow-y-auto flex-1 pr-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[10px] font-mono text-[var(--text-primary)]0 uppercase tracking-widest bg-[var(--bg-card)] sticky top-0 py-2">
                    <th className="pb-3 pl-2">Period Month</th>
                    <th className="pb-3">Opening NBV</th>
                    <th className="pb-3">Depreciation</th>
                    <th className="pb-3">Closing NBV</th>
                    <th className="pb-3">Accumulated</th>
                    <th className="pb-3 text-right">Posting Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] font-mono">
                  {schedule.map(row => (
                    <tr key={row.id} className="hover:bg-[var(--surface-hover)]">
                      <td className="py-3 pl-2 font-bold text-[var(--text-secondary)]">
                        {new Date(row.period_month).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3 text-[var(--text-secondary)]">{formatAED(row.opening_nbv)}</td>
                      <td className="py-3 text-[var(--status-warning-text)] font-bold">{formatAED(row.depreciation_amount)}</td>
                      <td className="py-3 text-[var(--text-secondary)]">{formatAED(row.closing_nbv)}</td>
                      <td className="py-3 text-[var(--text-secondary)]">{formatAED(row.accumulated)}</td>
                      <td className="py-3 text-right">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
                          row.posted 
                            ? 'bg-[var(--accent-glow)] text-[var(--accent)] border border-[var(--accent)]' 
                            : 'bg-[var(--surface-hover)] text-[var(--text-primary)]0 border border-[var(--border)]'
                        }`}>
                          {row.posted ? 'Posted GL' : 'Draft'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* MODAL: DISPOSAL FORM */}
        {showDisposalModal && (
          <div className="fixed inset-0 z-50 bg-[var(--bg-card)] backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 relative">
              <h2 className="font-heading font-extrabold text-sm uppercase tracking-wider text-[var(--text-primary)] mb-4">
                Dispose Asset Profile
              </h2>
              <form onSubmit={handleDisposalSubmit} className="flex flex-col gap-4 text-xs">
                {asset.linked_vehicle_id && (
                  <div className="p-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg flex items-start gap-2.5 text-xs text-[var(--status-danger-text)]">
                    <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-bold block">Vehicle status synchronization:</span>
                      Disposing this asset will automatically flag the vehicle as SOLD (if method is Sale) or DISPOSED (if Scrap/Lost/Trade-in).
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1.5 font-mono">Disposal Date</label>
                    <input
                      type="date"
                      value={disposalForm.disposal_date}
                      onChange={(e) => setDisposalForm({ ...disposalForm, disposal_date: e.target.value })}
                      required
                      className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1.5 font-mono">Disposal Method</label>
                    <select
                      value={disposalForm.method}
                      onChange={(e) => setDisposalForm({ ...disposalForm, method: e.target.value as any })}
                      required
                      className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
                    >
                      <option value="SALE">Sale (Commercial)</option>
                      <option value="SCRAP">Scrap</option>
                      <option value="TRADE_IN">Trade In</option>
                      <option value="LOST">Lost / Stolen</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1.5 font-mono">Proceeds (AED)</label>
                    <input
                      type="number"
                      value={disposalForm.proceeds || ''}
                      onChange={(e) => setDisposalForm({ ...disposalForm, proceeds: Number(e.target.value) })}
                      required
                      min={0}
                      className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1.5 font-mono">Buyer / Counterparty (Opt)</label>
                    <input
                      type="text"
                      value={disposalForm.buyer}
                      onChange={(e) => setDisposalForm({ ...disposalForm, buyer: e.target.value })}
                      placeholder="e.g. Scrap Yard LLC"
                      className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[var(--text-secondary)] mb-1.5 font-mono">Disposal Audit Reason</label>
                  <textarea
                    value={disposalForm.notes}
                    onChange={(e) => setDisposalForm({ ...disposalForm, notes: e.target.value })}
                    required
                    placeholder="Provide details for why the asset was retired, sale receipts info, or scrap approvals..."
                    rows={3}
                    className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowDisposalModal(false)}
                    className="px-4 py-2 bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] rounded-lg hover:text-[var(--text-primary)] font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-[var(--status-danger-bg)] text-white rounded-lg font-bold hover:bg-[var(--status-danger-bg)] flex items-center gap-1.5"
                  >
                    {submitting && <RefreshCw size={12} className="animate-spin" />}
                    Confirm Disposal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
