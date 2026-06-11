'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Car, 
  User, 
  AlertTriangle, 
  Fuel, 
  Wrench, 
  FileText, 
  DollarSign, 
  Calendar, 
  Plus, 
  ArrowLeft, 
  Signature, 
  ShieldAlert, 
  Check, 
  Info,
  Clock
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useVehicle } from '@/hooks/useVehicles';
import type { Employee } from '@/types/hr.types';
import type { Project } from '@/types/project.types';

export default function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const vehicleId = resolvedParams.id;
  const { 
    vehicle, 
    assignments, 
    fines, 
    fuelLogs, 
    maintenance, 
    loading, 
    refetch,
    updateProfile,
    deleteVehicle,
    assignDriver,
    endDriverAssignment,
    addFuelLog,
    addMaintenanceLog,
    updateMaintenanceLog
  } = useVehicle(vehicleId);

  const [activeTab, setActiveTab] = useState<'profile' | 'assignments' | 'fines' | 'fuel' | 'maintenance' | 'documents' | 'costs'>('profile');
  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  
  // Modals / Form States
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [showFineModal, setShowFineModal] = useState(false);
  
  const [assignForm, setAssignForm] = useState({
    driver_id: '',
    handover_odometer: 0,
    purpose: '',
    project_id: '',
    condition_notes: ''
  });

  const [fuelForm, setFuelForm] = useState({
    log_date: new Date().toISOString().substring(0, 10),
    odometer_km: 0,
    litres: 0,
    amount: 0,
    fuel_type: 'SPECIAL_95' as any,
    station: '',
    card_number: '',
    driver_id: '',
    project_id: ''
  });

  const [maintForm, setMaintForm] = useState({
    type: 'SERVICE' as any,
    service_date: new Date().toISOString().substring(0, 10),
    odometer_km: 0,
    vendor: '',
    description: '',
    cost: 0,
    next_service_odometer: '',
    next_service_date: '',
    downtime_days: 0,
    status: 'SCHEDULED' as any
  });

  const [fineForm, setFineForm] = useState({
    fine_number: '',
    fine_date: new Date().toISOString().substring(0, 10),
    fine_time: '',
    location: '',
    violation_type: '',
    amount: 0,
    black_points: 0,
    source: 'DUBAI_POLICE' as any,
    driver_id: '',
    status: 'UNPAID' as any
  });

  // End assignment states
  const [showEndAssignModal, setShowEndAssignModal] = useState(false);
  const [endAssignId, setEndAssignId] = useState('');
  const [endAssignForm, setEndAssignForm] = useState({
    return_odometer: 0,
    condition_notes: '',
    signature_path: ''
  });

  // Payroll deduction state
  const [payrollPeriod, setPayrollPeriod] = useState(new Date().toISOString().substring(0, 7));

  useEffect(() => {
    // Fetch employee and project options for dropdowns
    supabase
      .from('employees')
      .select('id, full_name_en')
      .eq('status', 'ACTIVE')
      .then(({ data }) => setEmployees(data || []));

    supabase
      .from('projects')
      .select('id, name, project_number')
      .then(({ data }) => setProjects(data || []));
  }, []);

  useEffect(() => {
    if (vehicle) {
      setAssignForm(prev => ({ ...prev, handover_odometer: vehicle.odometer_km }));
      setFuelForm(prev => ({ ...prev, odometer_km: vehicle.odometer_km }));
      setMaintForm(prev => ({ ...prev, odometer_km: vehicle.odometer_km }));
      setEndAssignForm(prev => ({ ...prev, return_odometer: vehicle.odometer_km }));
    }
  }, [vehicle]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060814] text-[#f8fafc] flex items-center justify-center font-mono text-xs">
        Loading vehicle workspace...
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen bg-[#060814] text-[#f8fafc] flex flex-col items-center justify-center gap-4">
        <span className="text-xs font-mono text-slate-500">Vehicle record not found or deleted.</span>
        <Link href="/fleet" className="text-xs text-[var(--primary)] font-bold flex items-center gap-1.5">
          <ArrowLeft size={14} /> Back to Fleet Directory
        </Link>
      </div>
    );
  }

  // TCO calculation
  const totalFuelCost = fuelLogs.reduce((sum, log) => sum + Number(log.amount), 0);
  const totalMaintCost = maintenance.filter(m => m.status === 'COMPLETED').reduce((sum, m) => sum + Number(m.cost), 0);
  const totalFinesCost = fines.reduce((sum, f) => sum + Number(f.amount), 0);
  const insuranceCost = 1200; // default premium placeholder
  const depreciation = 2400; // default accum dep placeholder
  const tco = totalFuelCost + totalMaintCost + totalFinesCost + insuranceCost + depreciation;
  const costPerKm = vehicle.odometer_km > 0 ? tco / vehicle.odometer_km : 0;

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await assignDriver({
        ...assignForm,
        from_date: new Date().toISOString()
      });
      setShowAssignModal(false);
      refetch();
    } catch (err: any) {
      alert(err.message || 'Failed to assign driver');
    }
  };

  const handleEndAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await endDriverAssignment(
        endAssignId,
        endAssignForm.return_odometer,
        endAssignForm.condition_notes,
        endAssignForm.signature_path || '/signatures/handback.png'
      );
      setShowEndAssignModal(false);
      refetch();
    } catch (err: any) {
      alert(err.message || 'Failed to end assignment');
    }
  };

  const handleFuelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addFuelLog(fuelForm);
      setShowFuelModal(false);
      refetch();
    } catch (err: any) {
      alert(err.message || 'Failed to log fuel');
    }
  };

  const handleMaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addMaintenanceLog({
        ...maintForm,
        next_service_odometer: maintForm.next_service_odometer ? Number(maintForm.next_service_odometer) : null,
        next_service_date: maintForm.next_service_date || null
      });
      setShowMaintModal(false);
      refetch();
    } catch (err: any) {
      alert(err.message || 'Failed to add maintenance log');
    }
  };

  const handleFineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await supabase.from('vehicle_fines').insert({
        ...fineForm,
        vehicle_id: vehicleId,
        driver_id: fineForm.driver_id || null,
        fine_time: fineForm.fine_time || null
      });
      setShowFineModal(false);
      refetch();
    } catch (err: any) {
      alert(err.message || 'Failed to log fine');
    }
  };

  const handleMarkDeduction = async (fineId: string) => {
    try {
      const pMonth = payrollPeriod + '-01';
      // Call service via hooks
      const { fineService } = await import('@/services/fineService');
      await fineService.markFineDriverLiable(fineId, pMonth);
      alert('Driver-liable payroll adjustment deduction submitted successfully!');
      refetch();
    } catch (err: any) {
      alert(err.message || 'Failed to process driver-liability');
    }
  };

  const formatAED = (val: number) => {
    return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(val).replace('AED', '').trim() + ' AED';
  };

  const getDaysRemainingStr = (dateStr: string) => {
    const expiry = new Date(dateStr);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: `EXPIRED (${Math.abs(diffDays)} days ago)`, color: 'text-red-400 font-bold animate-pulse' };
    if (diffDays <= 7) return { text: `${diffDays} days left (Critical)`, color: 'text-red-400 font-bold' };
    if (diffDays <= 30) return { text: `${diffDays} days left (Amber)`, color: 'text-amber-400 font-semibold' };
    return { text: `${diffDays} days left`, color: 'text-slate-400' };
  };

  const activeAssignment = assignments.find(a => !a.to_date);

  return (
    <div className="min-h-screen bg-[#060814] text-[#f8fafc]">
<main className="max-w-[1600px] mx-auto px-6 py-8">
        
        {/* BACK TO DIRECTORY */}
        <Link href="/fleet" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 mb-6 font-semibold">
          <ArrowLeft size={13} /> Back to Fleet list
        </Link>

        {/* WORKSPACE HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-900 pb-6 mb-8 gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)] shadow-[0_0_20px_rgba(0,229,160,0.1)]">
              <Car size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-extrabold text-xl text-slate-100 uppercase">
                  {vehicle.vehicle_code}
                </span>
                <span className="font-mono text-xs bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-400">
                  {vehicle.plate_number} ({vehicle.plate_emirate})
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 font-mono">
                {vehicle.make} {vehicle.model} • Odo: {vehicle.odometer_km.toLocaleString()} km • status:{' '}
                <span className="text-[var(--primary)] font-bold">{vehicle.status}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeAssignment ? (
              <button 
                onClick={() => {
                  setEndAssignId(activeAssignment.id);
                  setEndAssignForm(prev => ({ ...prev, return_odometer: vehicle.odometer_km }));
                  setShowEndAssignModal(true);
                }}
                className="px-4 py-2 text-xs font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 rounded-lg transition-all font-mono"
              >
                Hand Back (Custody Release)
              </button>
            ) : (
              <button 
                onClick={() => setShowAssignModal(true)}
                className="px-4 py-2 text-xs font-bold bg-[var(--primary)] text-slate-950 hover:bg-[var(--primary-hover)] rounded-lg transition-all font-mono"
              >
                Assign Custody (Driver)
              </button>
            )}
          </div>
        </div>

        {/* COMPLIANCE ALERT BOXES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="p-4 bg-slate-900/35 border border-slate-900 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <FileText size={16} />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Mulkiya Renewal</span>
                <div className="text-xs font-semibold text-slate-200 mt-0.5">
                  Expiry: {new Date(vehicle.registration_expiry).toLocaleDateString('en-GB')}
                </div>
              </div>
            </div>
            <span className={`text-[10px] font-mono ${getDaysRemainingStr(vehicle.registration_expiry).color}`}>
              {getDaysRemainingStr(vehicle.registration_expiry).text}
            </span>
          </div>

          <div className="p-4 bg-slate-900/35 border border-slate-900 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShieldAlert size={16} />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Insurance Policy</span>
                <div className="text-xs font-semibold text-slate-200 mt-0.5">
                  Expiry: {new Date(vehicle.insurance_expiry).toLocaleDateString('en-GB')}
                </div>
              </div>
            </div>
            <span className={`text-[10px] font-mono ${getDaysRemainingStr(vehicle.insurance_expiry).color}`}>
              {getDaysRemainingStr(vehicle.insurance_expiry).text}
            </span>
          </div>
        </div>

        {/* WORKSPACE NAVIGATION TABS */}
        <div className="flex items-center gap-2 border-b border-slate-900 pb-3 mb-8 overflow-x-auto">
          {(['profile', 'assignments', 'fines', 'fuel', 'maintenance', 'costs'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize font-mono transition-all ${
                activeTab === tab 
                  ? 'bg-slate-900 border border-slate-800 text-[var(--primary)] font-bold' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/35'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* TAB WORKSPACES */}
        <div className="min-h-[400px]">
          
          {/* TAB 1: Profile */}
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 p-6 bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-color)] rounded-xl flex flex-col gap-6">
                <h3 className="font-heading font-bold text-xs uppercase tracking-widest text-slate-300 border-b border-slate-950 pb-3">
                  Vehicle Specifications
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase font-mono">Make & Model</span>
                    <span className="text-xs text-slate-200 font-bold mt-1 block">{vehicle.make} {vehicle.model}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase font-mono">Model Year</span>
                    <span className="text-xs text-slate-200 font-mono mt-1 block">{vehicle.year}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase font-mono">Vehicle Type</span>
                    <span className="text-xs text-slate-200 font-mono mt-1 block">{vehicle.vehicle_type}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase font-mono">Chassis Number</span>
                    <span className="text-xs text-slate-200 font-mono mt-1 block">{vehicle.chassis_no}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase font-mono">Engine Number</span>
                    <span className="text-xs text-slate-200 font-mono mt-1 block">{vehicle.engine_no}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase font-mono">Seating Capacity</span>
                    <span className="text-xs text-slate-200 font-mono mt-1 block">{vehicle.seating_capacity || 'N/A'}</span>
                  </div>
                </div>

                <h3 className="font-heading font-bold text-xs uppercase tracking-widest text-slate-300 border-b border-slate-950 pb-3 mt-4">
                  Ownership & Purchase Details
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase font-mono">Ownership Status</span>
                    <span className="text-xs text-slate-200 font-bold mt-1 block">{vehicle.ownership}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase font-mono">Purchase Date</span>
                    <span className="text-xs text-slate-200 font-mono mt-1 block">
                      {vehicle.purchase_date ? new Date(vehicle.purchase_date).toLocaleDateString('en-GB') : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase font-mono">Purchase Cost</span>
                    <span className="text-xs text-slate-200 font-mono mt-1 block">
                      {vehicle.purchase_cost ? formatAED(vehicle.purchase_cost) : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase font-mono">Linked Asset</span>
                    {vehicle.fixed_asset_id ? (
                      <Link 
                        href={`/assets/${vehicle.fixed_asset_id}`}
                        className="text-xs text-[var(--primary)] font-bold mt-1 block hover:underline"
                      >
                        {vehicle.asset_number || 'View Asset Register'}
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-500 italic mt-1 block">Not linked to Asset Register</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Sidebar profile info */}
              <div className="p-6 bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-color)] rounded-xl flex flex-col gap-6">
                <h3 className="font-heading font-bold text-xs uppercase tracking-widest text-slate-300 border-b border-slate-950 pb-3">
                  Salik & Insurance Information
                </h3>
                <div>
                  <span className="block text-[10px] text-slate-500 uppercase font-mono">Salik Tag Number</span>
                  <span className="text-xs text-slate-200 font-mono mt-1 block">{vehicle.salik_tag_number || 'N/A'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 uppercase font-mono">Salik Account Link</span>
                  <span className="text-xs text-slate-200 font-mono mt-1 block">{vehicle.salik_account || 'N/A'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 uppercase font-mono">Insurance Company</span>
                  <span className="text-xs text-slate-200 font-semibold mt-1 block">{vehicle.insurance_company}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 uppercase font-mono">Policy Number</span>
                  <span className="text-xs text-slate-200 font-mono mt-1 block">{vehicle.insurance_policy_no}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Assignments */}
          {activeTab === 'assignments' && (
            <div className="p-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-heading font-bold text-xs uppercase tracking-widest text-slate-200">
                  Custody Chain & Handovers
                </h3>
              </div>

              {assignments.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-xs text-slate-500 font-mono border border-dashed border-slate-900 rounded-lg">
                  No custody logs registered for this vehicle.
                </div>
              ) : (
                <div className="relative border-l border-slate-900 pl-6 ml-3 gap-6 flex flex-col">
                  {assignments.map(a => (
                    <div key={a.id} className="relative bg-slate-950/50 border border-slate-900 p-4 rounded-xl flex flex-col sm:flex-row justify-between gap-4">
                      {/* Timeline dot */}
                      <span className={`absolute -left-[31px] top-5 h-4.5 w-4.5 rounded-full border border-[#060814] ${!a.to_date ? 'bg-[var(--primary)]' : 'bg-slate-800'}`}></span>
                      
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-200">{a.driver_name}</span>
                          {!a.to_date && (
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase">
                              Active Custody
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 mt-1.5">
                          Purpose: {a.purpose} {a.project_name ? `• Project: ${a.project_name}` : ''}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-2 font-mono flex items-center gap-1.5">
                          <Clock size={11} />
                          {new Date(a.from_date).toLocaleDateString('en-GB')} {new Date(a.from_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          {a.to_date ? ` to ${new Date(a.to_date).toLocaleDateString('en-GB')}` : ' (Present)'}
                        </div>
                      </div>

                      <div className="text-xs sm:text-right flex sm:flex-col justify-between items-baseline sm:justify-start gap-2">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase block">Handover Odo</span>
                          <span className="font-mono text-slate-300">{a.handover_odometer.toLocaleString()} km</span>
                        </div>
                        {a.to_date && (
                          <div className="sm:mt-2">
                            <span className="text-[10px] text-slate-500 uppercase block">Return Odo</span>
                            <span className="font-mono text-slate-300">{(a.return_odometer || 0).toLocaleString()} km</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Fines */}
          {activeTab === 'fines' && (
            <div className="p-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-heading font-bold text-xs uppercase tracking-widest text-slate-200">
                  Traffic Violation History ({fines.length} records)
                </h3>
                <button 
                  onClick={() => setShowFineModal(true)}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-900 border border-slate-800 text-slate-200 rounded-lg hover:bg-slate-800 transition-all font-mono"
                >
                  Log Fine Notice
                </button>
              </div>

              {/* Payroll period select bar for driver liabilities */}
              {fines.some(f => f.status === 'UNPAID') && (
                <div className="mb-4 p-3 bg-slate-950/50 border border-slate-900 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Info size={14} className="text-amber-400" />
                    Adjustments target payroll period:
                    <input 
                      type="month"
                      value={payrollPeriod}
                      onChange={(e) => setPayrollPeriod(e.target.value)}
                      className="bg-slate-900 border border-slate-800 text-slate-200 px-2 py-1 rounded"
                    />
                  </div>
                </div>
              )}

              {fines.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-xs text-slate-500 font-mono border border-dashed border-slate-900 rounded-lg">
                  No traffic violations registered.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-900 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                        <th className="pb-3">Fine Number</th>
                        <th className="pb-3">Fine Date</th>
                        <th className="pb-3">Authority</th>
                        <th className="pb-3">Offence</th>
                        <th className="pb-3">Attributed Driver</th>
                        <th className="pb-3">Amount</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-950/40 text-xs">
                      {fines.map(f => (
                        <tr key={f.id} className="hover:bg-slate-900/10">
                          <td className="py-4 font-mono font-bold text-slate-200">{f.fine_number}</td>
                          <td className="py-4 font-mono text-[10px] text-slate-400">
                            {new Date(f.fine_date).toLocaleDateString('en-GB')} {f.fine_time || ''}
                          </td>
                          <td className="py-4 text-[10px] text-slate-400 font-mono">{f.source}</td>
                          <td className="py-4 text-slate-300">
                            {f.violation_type} {f.black_points > 0 && <span className="text-red-400">({f.black_points} pts)</span>}
                          </td>
                          <td className="py-4">
                            {f.driver_name ? (
                              <span className="text-slate-300">{f.driver_name}</span>
                            ) : (
                              <span className="text-slate-600 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="py-4 font-mono font-bold text-slate-200">{formatAED(f.amount)}</td>
                          <td className="py-4">
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-mono uppercase font-bold border ${
                              f.status === 'PAID'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : f.status === 'TRANSFERRED_TO_DRIVER'
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>
                              {f.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-4 text-right">
                            {f.status === 'UNPAID' && f.driver_id && (
                              <button
                                onClick={() => handleMarkDeduction(f.id)}
                                className="text-[10px] font-bold text-purple-400 hover:text-purple-300 hover:underline"
                              >
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
          )}

          {/* TAB 4: Fuel */}
          {activeTab === 'fuel' && (
            <div className="p-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-heading font-bold text-xs uppercase tracking-widest text-slate-200">
                  Fuel Consumption Ledger
                </h3>
                <button 
                  onClick={() => setShowFuelModal(true)}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-900 border border-slate-800 text-slate-200 rounded-lg hover:bg-slate-800 transition-all font-mono"
                >
                  Log Fill-up
                </button>
              </div>

              {fuelLogs.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-xs text-slate-500 font-mono border border-dashed border-slate-900 rounded-lg">
                  No fuel fill-ups registered.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-900 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                        <th className="pb-3">Fill Date</th>
                        <th className="pb-3">Odometer</th>
                        <th className="pb-3">Litres</th>
                        <th className="pb-3">Amount</th>
                        <th className="pb-3">Type</th>
                        <th className="pb-3">Efficiency</th>
                        <th className="pb-3">Driver</th>
                        <th className="pb-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-950/40 text-xs">
                      {fuelLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-900/10">
                          <td className="py-4 font-mono text-[10px] text-slate-400">
                            {new Date(log.log_date).toLocaleDateString('en-GB')}
                          </td>
                          <td className="py-4 font-mono text-slate-300">{log.odometer_km.toLocaleString()} km</td>
                          <td className="py-4 font-mono text-slate-300">{log.litres.toFixed(2)} L</td>
                          <td className="py-4 font-mono font-bold text-slate-200">{formatAED(log.amount)}</td>
                          <td className="py-4 text-slate-400">{log.fuel_type}</td>
                          <td className="py-4 font-mono font-bold text-slate-300">
                            {log.efficiency_km_l > 0 ? `${log.efficiency_km_l.toFixed(2)} km/L` : 'First fill'}
                          </td>
                          <td className="py-4 text-slate-300">{log.driver_name}</td>
                          <td className="py-4 text-right">
                            {log.is_anomaly ? (
                              <span className="bg-red-500/15 text-red-400 border border-red-500/25 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase animate-pulse">
                                Anomaly Flag
                              </span>
                            ) : (
                              <span className="text-slate-600 font-mono text-[10px]">Normal</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Maintenance */}
          {activeTab === 'maintenance' && (
            <div className="p-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-heading font-bold text-xs uppercase tracking-widest text-slate-200">
                  Maintenance & Service logs
                </h3>
                <button 
                  onClick={() => setShowMaintModal(true)}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-900 border border-slate-800 text-slate-200 rounded-lg hover:bg-slate-800 transition-all font-mono"
                >
                  Schedule Service
                </button>
              </div>

              {maintenance.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-xs text-slate-500 font-mono border border-dashed border-slate-900 rounded-lg">
                  No maintenance records found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-900 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                        <th className="pb-3">Service Date</th>
                        <th className="pb-3">Odometer</th>
                        <th className="pb-3">Type</th>
                        <th className="pb-3">Vendor</th>
                        <th className="pb-3">Description</th>
                        <th className="pb-3">Cost</th>
                        <th className="pb-3">Downtime</th>
                        <th className="pb-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-950/40 text-xs">
                      {maintenance.map(m => (
                        <tr key={m.id} className="hover:bg-slate-900/10">
                          <td className="py-4 font-mono text-[10px] text-slate-400">
                            {new Date(m.service_date).toLocaleDateString('en-GB')}
                          </td>
                          <td className="py-4 font-mono text-slate-300">{m.odometer_km.toLocaleString()} km</td>
                          <td className="py-4 font-mono text-[10px] text-slate-400">{m.type}</td>
                          <td className="py-4 text-slate-300 font-semibold">{m.vendor}</td>
                          <td className="py-4 text-slate-400">{m.description}</td>
                          <td className="py-4 font-mono font-bold text-slate-200">{formatAED(m.cost)}</td>
                          <td className="py-4 font-mono text-slate-400">{m.downtime_days} days</td>
                          <td className="py-4 text-right">
                            {m.status === 'COMPLETED' ? (
                              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase">
                                Completed
                              </span>
                            ) : (
                              <button
                                onClick={async () => {
                                  if (confirm('Complete this scheduled service?')) {
                                    await updateMaintenanceLog(m.id, { status: 'COMPLETED', odometer_km: vehicle.odometer_km });
                                  }
                                }}
                                className="text-[10px] font-bold text-[var(--primary)] hover:underline"
                              >
                                Mark Complete
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
          )}

          {/* TAB 6: Costs (TCO) */}
          {activeTab === 'costs' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              
              <div className="md:col-span-2 p-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl flex flex-col gap-6">
                <h3 className="font-heading font-bold text-xs uppercase tracking-widest text-slate-300 border-b border-slate-950 pb-3">
                  TCO Cost Breakdown Ledger
                </h3>
                
                <div className="gap-4 flex flex-col">
                  {/* Row 1: Fuel */}
                  <div className="flex justify-between items-center text-xs p-3 bg-slate-950/40 border border-slate-900 rounded-lg">
                    <span className="text-slate-400 font-semibold flex items-center gap-1.5"><Fuel size={14} /> Total Fuel cost</span>
                    <span className="font-bold font-mono text-slate-200">{formatAED(totalFuelCost)}</span>
                  </div>
                  {/* Row 2: Maintenance */}
                  <div className="flex justify-between items-center text-xs p-3 bg-slate-950/40 border border-slate-900 rounded-lg">
                    <span className="text-slate-400 font-semibold flex items-center gap-1.5"><Wrench size={14} /> Total Maintenance Cost</span>
                    <span className="font-bold font-mono text-slate-200">{formatAED(totalMaintCost)}</span>
                  </div>
                  {/* Row 3: Fines */}
                  <div className="flex justify-between items-center text-xs p-3 bg-slate-950/40 border border-slate-900 rounded-lg">
                    <span className="text-slate-400 font-semibold flex items-center gap-1.5"><AlertTriangle size={14} /> Traffic Fines (all)</span>
                    <span className="font-bold font-mono text-slate-200">{formatAED(totalFinesCost)}</span>
                  </div>
                  {/* Row 4: Insurance */}
                  <div className="flex justify-between items-center text-xs p-3 bg-slate-950/40 border border-slate-900 rounded-lg">
                    <span className="text-slate-400 font-semibold flex items-center gap-1.5"><ShieldAlert size={14} /> Insurance Premiums</span>
                    <span className="font-bold font-mono text-slate-200">{formatAED(insuranceCost)}</span>
                  </div>
                  {/* Row 5: Depreciation */}
                  <div className="flex justify-between items-center text-xs p-3 bg-slate-950/40 border border-slate-900 rounded-lg">
                    <span className="text-slate-400 font-semibold flex items-center gap-1.5"><DollarSign size={14} /> Accumulated Asset Depreciation</span>
                    <span className="font-bold font-mono text-slate-200">{formatAED(depreciation)}</span>
                  </div>
                </div>
              </div>

              {/* Cost metrics summary */}
              <div className="p-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl flex flex-col justify-between h-[300px]">
                <div>
                  <h3 className="font-heading font-bold text-xs uppercase tracking-widest text-slate-300 border-b border-slate-950 pb-3 mb-6">
                    Total Cost of Ownership
                  </h3>
                  <div className="text-3xl font-heading font-extrabold text-[var(--primary)] font-mono">
                    {formatAED(tco)}
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono mt-1.5">
                    Accumulated costs including running expenses & asset depreciation
                  </p>
                </div>

                <div className="border-t border-slate-900 pt-4">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Running Cost / km</div>
                  <div className="text-lg font-heading font-bold text-slate-200 mt-1 font-mono">
                    {costPerKm.toFixed(4)} AED / km
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* MODAL: ASSIGN CUSTODY */}
        {showAssignModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0c0f24] border border-slate-800 rounded-2xl w-full max-w-md p-6 relative">
              <h2 className="font-heading font-extrabold text-sm uppercase tracking-wider text-slate-100 mb-4">
                Assign Custody to Driver
              </h2>
              <form onSubmit={handleAssignSubmit} className="flex flex-col gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1.5 font-mono">Select Driver (Employee)</label>
                  <select
                    value={assignForm.driver_id}
                    onChange={(e) => setAssignForm({ ...assignForm, driver_id: e.target.value })}
                    required
                    className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-[var(--primary)]"
                  >
                    <option value="">Choose Driver...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.full_name_en}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1.5 font-mono">Handover Odometer Reading (km)</label>
                  <input
                    type="number"
                    value={assignForm.handover_odometer}
                    onChange={(e) => setAssignForm({ ...assignForm, handover_odometer: Number(e.target.value) })}
                    required
                    min={vehicle.odometer_km}
                    className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1.5 font-mono">Purpose of Assignment</label>
                  <input
                    type="text"
                    value={assignForm.purpose}
                    onChange={(e) => setAssignForm({ ...assignForm, purpose: e.target.value })}
                    required
                    placeholder="e.g. Project site coordination / Technicians transport"
                    className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1.5 font-mono">Link Project (Optional)</label>
                  <select
                    value={assignForm.project_id}
                    onChange={(e) => setAssignForm({ ...assignForm, project_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-[var(--primary)]"
                  >
                    <option value="">No Project Tag...</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>[{p.project_number}] {p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(false)}
                    className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-400 rounded-lg hover:text-slate-200 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[var(--primary)] text-slate-950 rounded-lg font-bold hover:bg-[var(--primary-hover)]"
                  >
                    Assign Custody
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: END CUSTODY */}
        {showEndAssignModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0c0f24] border border-slate-800 rounded-2xl w-full max-w-md p-6 relative">
              <h2 className="font-heading font-extrabold text-sm uppercase tracking-wider text-slate-100 mb-4">
                Release Driver Custody
              </h2>
              <form onSubmit={handleEndAssignSubmit} className="flex flex-col gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1.5 font-mono">Return Odometer Reading (km)</label>
                  <input
                    type="number"
                    value={endAssignForm.return_odometer}
                    onChange={(e) => setEndAssignForm({ ...endAssignForm, return_odometer: Number(e.target.value) })}
                    required
                    min={vehicle.odometer_km}
                    className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1.5 font-mono">Condition Notes / Defects</label>
                  <textarea
                    value={endAssignForm.condition_notes}
                    onChange={(e) => setEndAssignForm({ ...endAssignForm, condition_notes: e.target.value })}
                    placeholder="Describe any scratch, dent, tyre wear, cleaning status, or mechanical issues..."
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div className="p-3 bg-slate-950 border border-slate-900 rounded-lg flex items-center gap-2">
                  <Signature className="text-emerald-400" size={16} />
                  <span className="text-[10px] text-slate-400">Driver Check-in signature canvas linked (Mocked)</span>
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowEndAssignModal(false)}
                    className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-400 rounded-lg hover:text-slate-200 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-500 text-slate-950 rounded-lg font-bold hover:bg-amber-400"
                  >
                    End Custody
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: LOG FUEL */}
        {showFuelModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0c0f24] border border-slate-800 rounded-2xl w-full max-w-md p-6 relative">
              <h2 className="font-heading font-extrabold text-sm uppercase tracking-wider text-slate-100 mb-4">
                Log Fuel Fill-up (Mobile Form)
              </h2>
              <form onSubmit={handleFuelSubmit} className="flex flex-col gap-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-mono">Fill Date</label>
                    <input
                      type="date"
                      value={fuelForm.log_date}
                      onChange={(e) => setFuelForm({ ...fuelForm, log_date: e.target.value })}
                      required
                      className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-mono">Fuel Type</label>
                    <select
                      value={fuelForm.fuel_type}
                      onChange={(e) => setFuelForm({ ...fuelForm, fuel_type: e.target.value })}
                      required
                      className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-[var(--primary)]"
                    >
                      <option value="SPECIAL_95">Special 95</option>
                      <option value="SUPER_98">Super 98</option>
                      <option value="DIESEL">Diesel</option>
                      <option value="ELECTRIC">Electric</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-slate-400 mb-1.5 font-mono">Odometer Reading (km)</label>
                    <input
                      type="number"
                      value={fuelForm.odometer_km}
                      onChange={(e) => setFuelForm({ ...fuelForm, odometer_km: Number(e.target.value) })}
                      required
                      min={vehicle.odometer_km}
                      className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-mono">Litres</label>
                    <input
                      type="number"
                      step="0.01"
                      value={fuelForm.litres || ''}
                      onChange={(e) => setFuelForm({ ...fuelForm, litres: Number(e.target.value) })}
                      required
                      className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-mono">Cost (AED)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={fuelForm.amount || ''}
                      onChange={(e) => setFuelForm({ ...fuelForm, amount: Number(e.target.value) })}
                      required
                      className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-mono">Fuel Card / Station</label>
                    <input
                      type="text"
                      value={fuelForm.station}
                      onChange={(e) => setFuelForm({ ...fuelForm, station: e.target.value })}
                      placeholder="e.g. ADNOC / ENOC"
                      className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-mono">Logging Driver</label>
                    <select
                      value={fuelForm.driver_id}
                      onChange={(e) => setFuelForm({ ...fuelForm, driver_id: e.target.value })}
                      required
                      className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-[var(--primary)]"
                    >
                      <option value="">Select...</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.full_name_en}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-mono">Link Project</label>
                    <select
                      value={fuelForm.project_id}
                      onChange={(e) => setFuelForm({ ...fuelForm, project_id: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-[var(--primary)]"
                    >
                      <option value="">No Project...</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>[{p.project_number}] {p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowFuelModal(false)}
                    className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-400 rounded-lg hover:text-slate-200 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[var(--primary)] text-slate-950 rounded-lg font-bold hover:bg-[var(--primary-hover)]"
                  >
                    Log Fill-up
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: LOG MAINTENANCE */}
        {showMaintModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0c0f24] border border-slate-800 rounded-2xl w-full max-w-md p-6 relative">
              <h2 className="font-heading font-extrabold text-sm uppercase tracking-wider text-slate-100 mb-4">
                Log Maintenance / Service Request
              </h2>
              <form onSubmit={handleMaintSubmit} className="flex flex-col gap-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-mono">Service Date</label>
                    <input
                      type="date"
                      value={maintForm.service_date}
                      onChange={(e) => setMaintForm({ ...maintForm, service_date: e.target.value })}
                      required
                      className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-mono">Service Type</label>
                    <select
                      value={maintForm.type}
                      onChange={(e) => setMaintForm({ ...maintForm, type: e.target.value as any })}
                      required
                      className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-[var(--primary)]"
                    >
                      <option value="SERVICE">Scheduled Service</option>
                      <option value="REPAIR">Repair</option>
                      <option value="TYRE">Tyres replacement</option>
                      <option value="BATTERY">Battery replacement</option>
                      <option value="ACCIDENT">Accident Repair</option>
                      <option value="INSPECTION">Inspection</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-slate-400 mb-1.5 font-mono">Odometer (km)</label>
                    <input
                      type="number"
                      value={maintForm.odometer_km}
                      onChange={(e) => setMaintForm({ ...maintForm, odometer_km: Number(e.target.value) })}
                      required
                      min={vehicle.odometer_km}
                      className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-mono">Cost (AED)</label>
                    <input
                      type="number"
                      value={maintForm.cost || ''}
                      onChange={(e) => setMaintForm({ ...maintForm, cost: Number(e.target.value) })}
                      required
                      className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-mono">Service Vendor</label>
                    <input
                      type="text"
                      value={maintForm.vendor}
                      onChange={(e) => setMaintForm({ ...maintForm, vendor: e.target.value })}
                      required
                      placeholder="e.g. Al Futtaim Toyota"
                      className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-mono">Downtime (Days)</label>
                    <input
                      type="number"
                      value={maintForm.downtime_days}
                      onChange={(e) => setMaintForm({ ...maintForm, downtime_days: Number(e.target.value) })}
                      required
                      className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1.5 font-mono">Description of Work</label>
                  <input
                    type="text"
                    value={maintForm.description}
                    onChange={(e) => setMaintForm({ ...maintForm, description: e.target.value })}
                    required
                    placeholder="e.g. 100,000 km minor service, brake pads replacement"
                    className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-mono">Next Service Odo (km)</label>
                    <input
                      type="number"
                      value={maintForm.next_service_odometer}
                      onChange={(e) => setMaintForm({ ...maintForm, next_service_odometer: e.target.value })}
                      placeholder="e.g. 110000"
                      className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-mono">Next Service Date</label>
                    <input
                      type="date"
                      value={maintForm.next_service_date}
                      onChange={(e) => setMaintForm({ ...maintForm, next_service_date: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1.5 font-mono">Status</label>
                  <select
                    value={maintForm.status}
                    onChange={(e) => setMaintForm({ ...maintForm, status: e.target.value as any })}
                    required
                    className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-[var(--primary)]"
                  >
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowMaintModal(false)}
                    className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-400 rounded-lg hover:text-slate-200 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[var(--primary)] text-slate-950 rounded-lg font-bold hover:bg-[var(--primary-hover)]"
                  >
                    Schedule Service
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: LOG FINE */}
        {showFineModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0c0f24] border border-slate-800 rounded-2xl w-full max-w-md p-6 relative">
              <h2 className="font-heading font-extrabold text-sm uppercase tracking-wider text-slate-100 mb-4">
                Log Fine Ticket Notice
              </h2>
              <form onSubmit={handleFineSubmit} className="flex flex-col gap-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-mono">Fine Number</label>
                    <input
                      type="text"
                      value={fineForm.fine_number}
                      onChange={(e) => setFineForm({ ...fineForm, fine_number: e.target.value })}
                      required
                      placeholder="e.g. DXB-1928472"
                      className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-mono">Fine Date</label>
                    <input
                      type="date"
                      value={fineForm.fine_date}
                      onChange={(e) => setFineForm({ ...fineForm, fine_date: e.target.value })}
                      required
                      className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-slate-400 mb-1.5 font-mono">Violation Type (Offence)</label>
                    <input
                      type="text"
                      value={fineForm.violation_type}
                      onChange={(e) => setFineForm({ ...fineForm, violation_type: e.target.value })}
                      required
                      placeholder="e.g. Speeding > 20km/h"
                      className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-mono">Black Points</label>
                    <input
                      type="number"
                      value={fineForm.black_points || ''}
                      onChange={(e) => setFineForm({ ...fineForm, black_points: Number(e.target.value) })}
                      required
                      className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-mono">Amount (AED)</label>
                    <input
                      type="number"
                      value={fineForm.amount || ''}
                      onChange={(e) => setFineForm({ ...fineForm, amount: Number(e.target.value) })}
                      required
                      className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 font-mono focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-mono">Fine Source</label>
                    <select
                      value={fineForm.source}
                      onChange={(e) => setFineForm({ ...fineForm, source: e.target.value as any })}
                      required
                      className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-[var(--primary)]"
                    >
                      <option value="DUBAI_POLICE">Dubai Police</option>
                      <option value="ABU_DHABI_POLICE">Abu Dhabi Police</option>
                      <option value="SHARJAH_POLICE">Sharjah Police</option>
                      <option value="RTA">RTA</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-mono">Location</label>
                    <input
                      type="text"
                      value={fineForm.location}
                      onChange={(e) => setFineForm({ ...fineForm, location: e.target.value })}
                      required
                      placeholder="e.g. Sheikh Zayed Road, Dubai"
                      className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-mono">Override Driver</label>
                    <select
                      value={fineForm.driver_id}
                      onChange={(e) => setFineForm({ ...fineForm, driver_id: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-[var(--primary)]"
                    >
                      <option value="">Auto-resolve from assignments...</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.full_name_en}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowFineModal(false)}
                    className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-400 rounded-lg hover:text-slate-200 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[var(--primary)] text-slate-950 rounded-lg font-bold hover:bg-[var(--primary-hover)]"
                  >
                    Log Fine
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
