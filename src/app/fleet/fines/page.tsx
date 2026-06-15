'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  AlertTriangle, 
  ArrowLeft, 
  Search, 
  Upload, 
  Check, 
  X, 
  RefreshCw, 
  Info, 
  UserPlus 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useFines } from '@/hooks/useFines';
import type { Employee } from '@/types/hr.types';
import type { Vehicle } from '@/types/fleet.types';

export default function FinesPage() {
  const { 
    fines, 
    loading, 
    error, 
    refetch, 
    markFineDriverLiable, 
    parseFineStatement, 
    commitBulkFines 
  } = useFines();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Import States
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reviewFines, setReviewFines] = useState<any[]>([]);
  
  // Select box mapping
  const [employees, setEmployees] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);

  // Payroll recovery periods
  const [payrollPeriod, setPayrollPeriod] = useState(new Date().toISOString().substring(0, 7));

  useEffect(() => {
    supabase
      .from('employees')
      .select('id, full_name_en')
      .eq('status', 'ACTIVE')
      .then(({ data }) => setEmployees(data || []));

    supabase
      .from('vehicles')
      .select('id, vehicle_code, plate_number')
      .eq('is_active', true)
      .then(({ data }) => setVehicles(data || []));
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const parsed = await parseFineStatement(file);
      
      // Match plate numbers extracted to actual vehicle_id in our DB
      const processed = await Promise.all(
        parsed.map(async f => {
          // Attempt to find vehicle by plate number or code
          // Let's guess standard plate matching or let user select
          // We can do a client-side match:
          const matchedVeh = vehicles.find(v => 
            v.plate_number.toLowerCase().replace(/\s/g, '').includes(f.plate_number?.toLowerCase()?.replace(/\s/g, '') || 'x_non_match_x') ||
            v.vehicle_code.toLowerCase().includes(f.plate_number?.toLowerCase() || 'x_non_match_x')
          );

          // Auto-resolve driver based on assignment dates if vehicle is matched
          let driverId = '';
          if (matchedVeh) {
            const fineStart = `${f.fine_date}T00:00:00.000Z`;
            const fineEnd = `${f.fine_date}T23:59:59.999Z`;
            const { data } = await supabase
              .from('vehicle_assignments')
              .select('driver_id')
              .eq('vehicle_id', matchedVeh.id)
              .lte('from_date', fineEnd)
              .or(`to_date.is.null,to_date.gte.${fineStart}`)
              .order('from_date', { ascending: false })
              .limit(1);

            if (data && data.length > 0) {
              driverId = data[0].driver_id;
            }
          }

          return {
            ...f,
            vehicle_id: matchedVeh?.id || '',
            driver_id: driverId || '',
            selected: true
          };
        })
      );

      setReviewFines(processed);
    } catch (err: any) {
      alert(err.message || 'Failed to parse statement document. Make sure Gemini API Key is configured.');
    } finally {
      setUploading(false);
    }
  };

  const handleBulkSubmit = async () => {
    const selectedFines = reviewFines.filter(f => f.selected);
    if (selectedFines.length === 0) {
      alert('Please select at least one fine row to import.');
      return;
    }

    // Verify all selected have a matched vehicle
    const missingVehicle = selectedFines.some(f => !f.vehicle_id);
    if (missingVehicle) {
      alert('Please select a matched vehicle for all checked fine rows.');
      return;
    }

    try {
      setUploading(true);
      const cleanFines = selectedFines.map(f => ({
        vehicle_id: f.vehicle_id,
        fine_number: f.fine_number,
        fine_date: f.fine_date,
        fine_time: f.fine_time || null,
        location: f.location,
        violation_type: f.violation_type,
        amount: Number(f.amount),
        black_points: Number(f.black_points || 0),
        source: f.source,
        driver_id: f.driver_id || null,
        status: f.status || 'UNPAID'
      }));

      await commitBulkFines(cleanFines);
      alert(`Successfully imported ${cleanFines.length} traffic fine records!`);
      setReviewFines([]);
      setShowImportPanel(false);
      refetch();
    } catch (err: any) {
      alert(err.message || 'Import failed');
    } finally {
      setUploading(false);
    }
  };

  const filteredFines = fines.filter(f => {
    const matchesSearch = f.fine_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (f.vehicle_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (f.plate_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (f.driver_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          f.violation_type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === '' || f.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleMarkLiable = async (fineId: string) => {
    try {
      const pMonth = payrollPeriod + '-01';
      await markFineDriverLiable(fineId, pMonth);
      alert('Deduction request posted successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to request deduction');
    }
  };

  const formatAED = (val: number) => {
    return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(val).replace('AED', '').trim() + ' AED';
  };

  return (
    <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text-primary)]">
<main className="max-w-[1600px] mx-auto px-6 py-8">
        
        {/* BACK BUTTON */}
        <Link href="/fleet" className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-6 font-semibold">
          <ArrowLeft size={13} /> Back to Fleet Dashboard
        </Link>

        {/* HEADER BAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-6 mb-8">
          <div>
            <h1 className="font-heading font-extrabold text-2xl tracking-tight text-[var(--text-primary)] flex items-center gap-2">
              <AlertTriangle size={24} className="text-[var(--status-warning-text)]" />
              Traffic Violations & Fines Ledger
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1 uppercase tracking-widest font-mono">
              RTA Salik, UAE Traffic Police imports & Driver liability recoveries
            </p>
          </div>
          <button
            onClick={() => setShowImportPanel(!showImportPanel)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] rounded-lg font-mono transition-all"
          >
            <Upload size={14} />
            Gemini Statement Import
          </button>
        </div>

        {/* GEMINI STATEMENT IMPORT PANEL */}
        {showImportPanel && (
          <div className="mb-8 p-6 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-heading font-bold text-xs uppercase tracking-widest text-[var(--text-primary)]">
                  Import Salik / Traffic Fine Statement (PDF/Excel)
                </h3>
                <p className="text-[10px] text-[var(--text-primary)]0 font-mono mt-1">
                  Upload an RTA Salik statement or Dubai/Abu Dhabi Police fine report. Gemini will parse rows for human review.
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowImportPanel(false);
                  setReviewFines([]);
                }}
                className="text-[var(--text-primary)]0 hover:text-[var(--text-secondary)]"
              >
                <X size={16} />
              </button>
            </div>

            {reviewFines.length === 0 ? (
              <div className="border border-dashed border-[var(--border)] rounded-xl p-8 flex flex-col items-center justify-center bg-[var(--bg-card)]">
                <Upload size={28} className="text-[var(--text-primary)]0 mb-3" />
                <label className="text-xs font-bold text-[var(--text-secondary)] cursor-pointer bg-[var(--surface-hover)] hover:bg-[var(--surface-hover)] border border-[var(--border)] px-4 py-2 rounded-lg transition-all font-mono">
                  {uploading ? 'Parsing File...' : 'Select Statement File'}
                  <input
                    type="file"
                    accept=".pdf,.xlsx,.xls,image/*"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
                <span className="text-[10px] text-[var(--text-tertiary)] mt-2 font-mono">Supports PDF statements or spreadsheet exports</span>
              </div>
            ) : (
              /* Review Grid Table */
              <div className="flex flex-col gap-4">
                <div className="overflow-x-auto max-h-[300px] border border-[var(--border)] rounded-xl">
                  <table className="w-full text-left border-collapse bg-[var(--bg-card)] text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[10px] font-mono text-[var(--text-primary)]0 uppercase tracking-widest bg-[var(--bg-card)] sticky top-0">
                        <th className="p-3 w-8">Import</th>
                        <th className="p-3">Fine No.</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Violation</th>
                        <th className="p-3">Authority</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Vehicle Code</th>
                        <th className="p-3">Attributed Driver</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {reviewFines.map((f, idx) => (
                        <tr key={idx} className="hover:bg-[var(--surface-hover)]">
                          <td className="p-3 text-center">
                            <input 
                              type="checkbox"
                              checked={f.selected}
                              onChange={(e) => {
                                const copy = [...reviewFines];
                                copy[idx].selected = e.target.checked;
                                setReviewFines(copy);
                              }}
                              className="accent-[var(--primary)]"
                            />
                          </td>
                          <td className="p-3 font-mono font-bold text-[var(--text-primary)]">{f.fine_number}</td>
                          <td className="p-3 font-mono text-[10px] text-[var(--text-secondary)]">{f.fine_date}</td>
                          <td className="p-3 text-[var(--text-secondary)]">{f.violation_type}</td>
                          <td className="p-3 text-[10px] font-mono text-[var(--text-primary)]0">{f.source}</td>
                          <td className="p-3 font-mono font-bold text-[var(--text-secondary)]">{formatAED(f.amount)}</td>
                          <td className="p-3">
                            <select
                              value={f.vehicle_id}
                              onChange={(e) => {
                                const copy = [...reviewFines];
                                copy[idx].vehicle_id = e.target.value;
                                setReviewFines(copy);
                              }}
                              required
                              className="bg-[var(--surface-hover)] border border-[var(--border)] rounded p-1 text-[11px] text-[var(--text-secondary)]"
                            >
                              <option value="">Select Vehicle...</option>
                              {vehicles.map(v => (
                                <option key={v.id} value={v.id}>{v.vehicle_code} ({v.plate_number})</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3">
                            <select
                              value={f.driver_id}
                              onChange={(e) => {
                                const copy = [...reviewFines];
                                copy[idx].driver_id = e.target.value;
                                setReviewFines(copy);
                              }}
                              className="bg-[var(--surface-hover)] border border-[var(--border)] rounded p-1 text-[11px] text-[var(--text-secondary)]"
                            >
                              <option value="">Unassigned...</option>
                              {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.full_name_en}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setReviewFines([])}
                    className="px-4 py-2 bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] rounded-lg hover:text-[var(--text-primary)] text-xs font-semibold"
                  >
                    Clear Results
                  </button>
                  <button
                    onClick={handleBulkSubmit}
                    disabled={uploading}
                    className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg font-bold hover:bg-[var(--primary-hover)] text-xs flex items-center gap-1.5"
                  >
                    {uploading && <RefreshCw size={12} className="animate-spin" />}
                    Confirm Bulk Create
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FINES DIRECTORY TABLE */}
        <div className="p-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="font-heading font-extrabold text-sm uppercase tracking-wider text-[var(--text-primary)]">
              Active Violations Ledger ({filteredFines.length} fines)
            </h3>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-primary)]0" />
                <input 
                  type="text"
                  placeholder="Search fine, code, driver, location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg pl-9 pr-4 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--primary)] transition-all"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--primary)]"
              >
                <option value="">All Statuses</option>
                <option value="UNPAID">Unpaid</option>
                <option value="PAID">Paid</option>
                <option value="TRANSFERRED_TO_DRIVER">Transferred to Driver</option>
                <option value="DISPUTED">Disputed</option>
              </select>

              {/* Payroll period select */}
              <div className="flex items-center gap-1 text-[10px] text-[var(--text-primary)]0 font-mono">
                Deductions target:
                <input 
                  type="month"
                  value={payrollPeriod}
                  onChange={(e) => setPayrollPeriod(e.target.value)}
                  className="bg-[var(--bg-card)] border border-[var(--border)] rounded px-1.5 py-1 text-[var(--text-secondary)]"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="h-60 flex items-center justify-center text-xs font-mono text-[var(--text-primary)]0">
              <RefreshCw className="animate-spin mr-2" size={15} /> Loading traffic fines...
            </div>
          ) : filteredFines.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-xs font-mono text-[var(--text-primary)]0 border border-dashed border-[var(--border)] rounded-lg">
              No traffic fines found matching filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[10px] font-mono text-[var(--text-primary)]0 uppercase tracking-widest">
                    <th className="pb-3">Fine Number</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Vehicle Code</th>
                    <th className="pb-3">Authority</th>
                    <th className="pb-3">Offence Details</th>
                    <th className="pb-3">Location</th>
                    <th className="pb-3">Attributed Driver</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-xs">
                  {filteredFines.map(f => (
                    <tr key={f.id} className="hover:bg-[var(--surface-hover)]">
                      <td className="py-4 font-mono font-bold text-[var(--text-primary)]">{f.fine_number}</td>
                      <td className="py-4 font-mono text-[10px] text-[var(--text-secondary)]">
                        {new Date(f.fine_date).toLocaleDateString('en-GB')} {f.fine_time || ''}
                      </td>
                      <td className="py-4 font-mono text-[var(--primary)] font-bold">
                        <Link href={`/fleet/${f.vehicle_id}`} className="hover:underline">
                          {f.vehicle_code}
                        </Link>
                      </td>
                      <td className="py-4 text-[10px] text-[var(--text-secondary)] font-mono">{f.source}</td>
                      <td className="py-4 text-[var(--text-secondary)]">
                        {f.violation_type} {f.black_points > 0 && <span className="text-[var(--status-danger-text)] font-bold">({f.black_points} pts)</span>}
                      </td>
                      <td className="py-4 text-[var(--text-secondary)]">{f.location}</td>
                      <td className="py-4">
                        {f.driver_name ? (
                          <span className="text-[var(--text-secondary)]">{f.driver_name}</span>
                        ) : (
                          <span className="text-[var(--text-tertiary)] italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-4 font-mono font-bold text-[var(--text-primary)]">{formatAED(f.amount)}</td>
                      <td className="py-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-mono uppercase font-bold border ${
                          f.status === 'PAID'
                            ? 'bg-[var(--accent-glow)] text-[var(--accent)] border-[var(--accent)]'
                            : f.status === 'TRANSFERRED_TO_DRIVER'
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                            : 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]'
                        }`}>
                          {f.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        {f.status === 'UNPAID' && f.driver_id && (
                          <button
                            onClick={() => handleMarkLiable(f.id)}
                            className="text-[10px] font-bold text-purple-400 hover:text-purple-300 hover:underline flex items-center justify-end gap-1"
                          >
                            <UserPlus size={11} />
                            Recover (Payroll)
                          </button>
                        )}
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
