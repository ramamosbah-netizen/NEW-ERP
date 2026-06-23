'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  BarChart3, 
  Plus, 
  Search, 
  RefreshCw, 
  ChevronRight, 
  DollarSign, 
  FileText,
  Calculator,
  User
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/PageHeader';
import { useFixedAssets } from '@/hooks/useFixedAssets';
import { DEFAULT_USEFUL_LIVES } from '@/constants/fleet.constants';
import type { Employee } from '@/types/hr.types';
import type { Vehicle } from '@/types/fleet.types';
import type { FixedAssetCategory } from '@/types/asset.types';

export default function AssetRegisterPage() {
  const { assets, loading, error, refetch, createAsset } = useFixedAssets();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);

  const [form, setForm] = useState({
    name: '',
    category: 'VEHICLE' as FixedAssetCategory,
    description: '',
    acquisition_date: new Date().toISOString().substring(0, 10),
    acquisition_cost: 0,
    salvage_value: 0,
    useful_life_months: 60,
    supplier_id: '',
    custodian_id: '',
    location: '',
    linked_vehicle_id: '',
    linked_tool_id: ''
  });

  useEffect(() => {
    supabase
      .from('employees')
      .select('id, full_name_en')
      .eq('status', 'ACTIVE')
      .then(({ data }) => setEmployees(data || []));

    supabase
      .from('vehicles')
      .select('id, vehicle_code, plate_number')
      .eq('ownership', 'OWNED')
      .eq('is_active', true)
      .is('fixed_asset_id', null) // only show unlinked vehicles
      .then(({ data }) => setVehicles(data || []));
  }, [showAddModal]);

  // Adjust default useful life when category changes
  const handleCategoryChange = (cat: FixedAssetCategory) => {
    setForm(prev => ({
      ...prev,
      category: cat,
      useful_life_months: DEFAULT_USEFUL_LIVES[cat] || 60
    }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.salvage_value > form.acquisition_cost) {
      alert('Salvage value cannot exceed acquisition cost');
      return;
    }

    try {
      setSaving(true);
      await createAsset({
        ...form,
        supplier_id: form.supplier_id || null,
        custodian_id: form.custodian_id || null,
        linked_vehicle_id: form.linked_vehicle_id || null,
        linked_tool_id: form.linked_tool_id || null
      });
      setShowAddModal(false);
      // Reset form
      setForm({
        name: '',
        category: 'VEHICLE',
        description: '',
        acquisition_date: new Date().toISOString().substring(0, 10),
        acquisition_cost: 0,
        salvage_value: 0,
        useful_life_months: 60,
        supplier_id: '',
        custodian_id: '',
        location: '',
        linked_vehicle_id: '',
        linked_tool_id: ''
      });
      refetch();
    } catch (err: any) {
      alert(err.message || 'Failed to capitalize fixed asset');
    } finally {
      setSaving(false);
    }
  };

  // Filtered Assets
  const filteredAssets = assets.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          a.asset_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (a.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (a.location || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === '' || a.category === categoryFilter;
    const matchesStatus = statusFilter === '' || a.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Calculate Aggregates
  const totalCost = filteredAssets.reduce((sum, a) => sum + Number(a.acquisition_cost), 0);
  const totalAccumDep = filteredAssets.reduce((sum, a) => sum + Number(a.accumulated_depreciation), 0);
  const totalNBV = filteredAssets.reduce((sum, a) => sum + Number(a.net_book_value), 0);

  // Group by Category for totals box
  const categorySummary: Record<string, { cost: number; accum: number; nbv: number }> = {};
  filteredAssets.forEach(a => {
    if (!categorySummary[a.category]) {
      categorySummary[a.category] = { cost: 0, accum: 0, nbv: 0 };
    }
    categorySummary[a.category].cost += Number(a.acquisition_cost);
    categorySummary[a.category].accum += Number(a.accumulated_depreciation);
    categorySummary[a.category].nbv += Number(a.net_book_value);
  });

  const formatAED = (val: number) => {
    return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(val).replace('AED', '').trim() + ' AED';
  };

  return (
    <div>
      <PageHeader
        title="Fixed Asset Register"
        subtitle="Capitalized assets registry, straight-line schedules & external accounting exports"
        actions={
          <>
            <Link
              href="/assets/depreciation"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Calculator size={14} />
              Depreciation Run
            </Link>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--primary)] text-[var(--bg-dark)] hover:bg-[var(--primary-hover)] rounded-lg transition-colors cursor-pointer"
            >
              <Plus size={14} />
              Capitalize Asset
            </button>
          </>
        }
      />

        {/* LEDGER AGGREGATES CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="p-5 bg-bg-card border border-border-color rounded-xl">
            <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest block">Gross Capitalized Cost</span>
            <div className="text-2xl font-heading font-bold text-text-primary mt-2 font-mono">
              {formatAED(totalCost)}
            </div>
            <div className="text-[10px] text-text-muted font-mono mt-1">Initial acquisition value of all items</div>
          </div>
          
          <div className="p-5 bg-bg-card border border-border-color rounded-xl">
            <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest block">Accumulated Depreciation</span>
            <div className="text-2xl font-heading font-bold text-warning mt-2 font-mono">
              {formatAED(totalAccumDep)}
            </div>
            <div className="text-[10px] text-text-muted font-mono mt-1">Total posted amortization MTD</div>
          </div>

          <div className="p-5 bg-bg-card border border-border-color rounded-xl">
            <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest block">Net Book Value (NBV)</span>
            <div className="text-2xl font-heading font-bold text-primary mt-2 font-mono">
              {formatAED(totalNBV)}
            </div>
            <div className="text-[10px] text-text-muted font-mono mt-1">Current balance sheet valuation</div>
          </div>
        </div>

        {/* SPLIT SCREEN LAYOUT: Category totals vs Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          
          {/* Category Totals bar */}
          <div className="p-5 bg-bg-card border border-border-color rounded-xl flex flex-col h-[400px]">
            <h3 className="font-heading font-bold text-xs uppercase tracking-widest text-text-secondary border-b border-border-color pb-3 mb-4 flex items-center gap-1.5">
              <BarChart3 size={13} className="text-primary" />
              Category Valuations
            </h3>
            <div className="overflow-y-auto flex-1 pr-1 gap-4 flex flex-col">
              {Object.keys(DEFAULT_USEFUL_LIVES).map(cat => {
                const vals = categorySummary[cat] || { cost: 0, accum: 0, nbv: 0 };
                return (
                  <div key={cat} className="p-2.5 bg-bg-dark/40 border border-border-color rounded-lg text-xs font-mono">
                    <span className="block text-[10px] text-text-secondary font-bold uppercase">{cat.replace(/_/g, ' ')}</span>
                    <div className="flex justify-between mt-2">
                      <span className="text-text-muted">Cost:</span>
                      <span className="text-text-secondary font-bold">{formatAED(vals.cost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">NBV:</span>
                      <span className="text-primary font-bold">{formatAED(vals.nbv)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MAIN ASSETS GRID */}
          <div className="lg:col-span-3 p-6 bg-bg-card border border-border-color rounded-xl flex flex-col min-h-[400px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h3 className="font-heading font-extrabold text-sm uppercase tracking-wider text-text-secondary">
                Capitalized Assets Register ({filteredAssets.length} items)
              </h3>
              
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input 
                    type="text"
                    placeholder="Search name, asset number, location..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-56 bg-bg-dark/60 border border-border-color rounded-lg pl-9 pr-4 py-1.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-primary transition-all"
                  />
                </div>

                {/* Category Filter */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-bg-dark/60 border border-border-color rounded-lg px-3 py-1.5 text-xs text-text-secondary focus:outline-none focus:border-primary"
                >
                  <option value="">All Categories</option>
                  <option value="VEHICLE">Vehicles</option>
                  <option value="IT_EQUIPMENT">IT Equipment</option>
                  <option value="TOOLS_INSTRUMENTS">Tools & Instruments</option>
                  <option value="OFFICE_FURNITURE">Office Furniture</option>
                  <option value="SITE_EQUIPMENT">Site Equipment</option>
                  <option value="SOFTWARE">Software</option>
                  <option value="OTHER">Other</option>
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-bg-dark/60 border border-border-color rounded-lg px-3 py-1.5 text-xs text-text-secondary focus:outline-none focus:border-primary"
                >
                  <option value="">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="FULLY_DEPRECIATED">Fully Depreciated</option>
                  <option value="DISPOSED">Disposed</option>
                  <option value="WRITTEN_OFF">Written Off</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="h-60 flex-1 flex items-center justify-center text-xs font-mono text-text-muted">
                <RefreshCw className="animate-spin mr-2" size={15} /> Loading Asset Register...
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="h-60 flex-1 flex items-center justify-center text-xs font-mono text-text-muted border border-dashed border-border-color rounded-lg">
                No capitalized assets registered.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-color text-[10px] font-mono text-text-muted uppercase tracking-widest">
                      <th className="pb-3">Asset Number</th>
                      <th className="pb-3">Name</th>
                      <th className="pb-3">Category</th>
                      <th className="pb-3">Acquisition Date</th>
                      <th className="pb-3">Cost</th>
                      <th className="pb-3">Accum. Dep.</th>
                      <th className="pb-3">Net Book Value</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-color/40 text-xs">
                    {filteredAssets.map(a => (
                      <tr key={a.id} className="hover:bg-bg-card-hover/20 group">
                        <td className="py-4 font-mono font-bold text-primary">
                          {a.asset_number}
                        </td>
                        <td className="py-4">
                          <span className="font-bold text-text-primary block">{a.name}</span>
                          <span className="text-[10px] text-text-muted font-mono mt-0.5 block">{a.location || '—'}</span>
                        </td>
                        <td className="py-4 text-[10px] text-text-secondary font-mono uppercase">
                          {a.category.replace(/_/g, ' ')}
                        </td>
                        <td className="py-4 font-mono text-[10px] text-text-secondary">
                          {new Date(a.acquisition_date).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-4 font-mono text-text-secondary">
                          {formatAED(a.acquisition_cost)}
                        </td>
                        <td className="py-4 font-mono text-warning">
                          {formatAED(a.accumulated_depreciation)}
                        </td>
                        <td className="py-4 font-mono font-bold text-text-primary">
                          {formatAED(a.net_book_value)}
                        </td>
                        <td className="py-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-mono uppercase font-bold border ${
                            a.status === 'ACTIVE'
                              ? 'bg-success-glow text-success border-success/20'
                              : a.status === 'FULLY_DEPRECIATED'
                              ? 'bg-secondary-glow text-secondary border-secondary-glow/20'
                              : 'bg-error-glow text-error border-error-glow/20'
                          }`}>
                            {a.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <Link
                            href={`/assets/${a.id}`}
                            className="inline-flex items-center gap-1 text-xs text-text-secondary group-hover:text-primary font-bold transition-all"
                          >
                            Ledger
                            <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* MODAL: CAPITALIZE ASSET */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-bg-dark/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-bg-card border border-border-color rounded-2xl w-full max-w-lg p-6 relative overflow-y-auto max-h-[90vh]">
              <h2 className="font-heading font-extrabold text-sm uppercase tracking-wider text-text-primary mb-4">
                Capitalize New Asset
              </h2>
              <form onSubmit={handleFormSubmit} className="flex flex-col gap-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-text-secondary mb-1.5 font-mono">Asset Name / Tag</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      placeholder="e.g. Server Room Backup UPS / Pickup Vehicle"
                      className="w-full bg-bg-dark border border-border-color rounded-lg p-2.5 text-text-primary focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-text-secondary mb-1.5 font-mono">Asset Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => handleCategoryChange(e.target.value as any)}
                      required
                      className="w-full bg-bg-dark border border-border-color rounded-lg p-2.5 text-text-primary focus:outline-none focus:border-primary"
                    >
                      <option value="VEHICLE">Vehicle (Owned)</option>
                      <option value="IT_EQUIPMENT">IT Equipment</option>
                      <option value="TOOLS_INSTRUMENTS">Tools & Instruments</option>
                      <option value="OFFICE_FURNITURE">Office Furniture</option>
                      <option value="SITE_EQUIPMENT">Site Equipment</option>
                      <option value="SOFTWARE">Software License</option>
                      <option value="OTHER">Other Asset</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-text-secondary mb-1.5 font-mono">Acquisition Date</label>
                    <input
                      type="date"
                      value={form.acquisition_date}
                      onChange={(e) => setForm({ ...form, acquisition_date: e.target.value })}
                      required
                      className="w-full bg-bg-dark border border-border-color rounded-lg p-2.5 text-text-primary focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-text-secondary mb-1.5 font-mono">Cost (AED)</label>
                    <input
                      type="number"
                      value={form.acquisition_cost || ''}
                      onChange={(e) => setForm({ ...form, acquisition_cost: Number(e.target.value) })}
                      required
                      min={1}
                      className="w-full bg-bg-dark border border-border-color rounded-lg p-2.5 text-text-primary font-mono focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-text-secondary mb-1.5 font-mono">Salvage Value (AED)</label>
                    <input
                      type="number"
                      value={form.salvage_value}
                      onChange={(e) => setForm({ ...form, salvage_value: Number(e.target.value) })}
                      required
                      min={0}
                      className="w-full bg-bg-dark border border-border-color rounded-lg p-2.5 text-text-primary font-mono focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-text-secondary mb-1.5 font-mono">Life (Months)</label>
                    <input
                      type="number"
                      value={form.useful_life_months}
                      onChange={(e) => setForm({ ...form, useful_life_months: Number(e.target.value) })}
                      required
                      min={1}
                      className="w-full bg-bg-dark border border-border-color rounded-lg p-2.5 text-text-primary font-mono focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* Conditional vehicle binding link */}
                {form.category === 'VEHICLE' && (
                  <div>
                    <label className="block text-text-secondary mb-1.5 font-mono">Link Owned Vehicle Profile</label>
                    <select
                      value={form.linked_vehicle_id}
                      onChange={(e) => setForm({ ...form, linked_vehicle_id: e.target.value })}
                      className="w-full bg-bg-dark border border-border-color rounded-lg p-2.5 text-text-primary focus:outline-none focus:border-primary"
                    >
                      <option value="">Create asset standalone...</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.vehicle_code} - {v.plate_number}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-text-secondary mb-1.5 font-mono">Custodian</label>
                    <select
                      value={form.custodian_id}
                      onChange={(e) => setForm({ ...form, custodian_id: e.target.value })}
                      className="w-full bg-bg-dark border border-border-color rounded-lg p-2.5 text-text-primary focus:outline-none focus:border-primary"
                    >
                      <option value="">No Custodian...</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.full_name_en}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-text-secondary mb-1.5 font-mono">Location / Site</label>
                    <input
                      type="text"
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                      placeholder="e.g. Head Office / DIP Store"
                      className="w-full bg-bg-dark border border-border-color rounded-lg p-2.5 text-text-primary focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-text-secondary mb-1.5 font-mono">Asset Description / Auditor Notes</label>
                  <textarea
                     value={form.description}
                     onChange={(e) => setForm({ ...form, description: e.target.value })}
                     placeholder="Enter any auditing specifications, serial markings, purchase vendor details..."
                     rows={2}
                     className="w-full bg-bg-dark border border-border-color rounded-lg p-2.5 text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 bg-bg-dark border border-border-color text-text-secondary rounded-lg hover:text-text-primary font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-primary text-bg-dark rounded-lg font-bold hover:bg-primary-hover flex items-center gap-1.5 cursor-pointer"
                  >
                    {saving && <RefreshCw size={12} className="animate-spin" />}
                    Capitalize
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

    </div>
  );
}
