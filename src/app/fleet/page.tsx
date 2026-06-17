'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Car, 
  Wrench, 
  AlertTriangle, 
  DollarSign, 
  Plus, 
  Calendar, 
  Users, 
  ShieldAlert, 
  Search, 
  RefreshCw, 
  ChevronRight, 
  Fuel 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Vehicle, VehicleFine, FuelLog, VehicleMaintenance } from '@/types/fleet.types';

export default function FleetDashboardPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fines, setFines] = useState<VehicleFine[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [maintenance, setMaintenance] = useState<VehicleMaintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch vehicles
      const { data: vData } = await supabase
        .from('vehicles')
        .select('*, employees:assigned_driver_id (full_name_en)')
        .eq('is_active', true);
      
      // Fetch fines
      const { data: fData } = await supabase
        .from('vehicle_fines')
        .select('*');

      // Fetch fuel logs
      const { data: fuelData } = await supabase
        .from('fuel_logs')
        .select('*');

      // Fetch maintenance
      const { data: maintData } = await supabase
        .from('vehicle_maintenance')
        .select('*');

      setVehicles((vData || []).map(v => ({
        ...v,
        driver_name: v.employees?.full_name_en
      })));
      setFines(fData || []);
      setFuelLogs(fuelData || []);
      setMaintenance(maintData || []);
    } catch (err) {
      console.error('Error loading fleet dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter vehicles
  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = v.plate_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          v.vehicle_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          v.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          v.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (v.driver_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === '' || v.status === statusFilter;
    const matchesType = typeFilter === '' || v.vehicle_type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  // Calculate statistics
  const totalVehicles = vehicles.length;
  const activeCount = vehicles.filter(v => v.status === 'ACTIVE').length;
  const workshopCount = vehicles.filter(v => v.status === 'IN_WORKSHOP').length;
  const offRoadCount = vehicles.filter(v => v.status === 'OFF_ROAD').length;

  // Outstanding Fines
  const unpaidFines = fines.filter(f => f.status === 'UNPAID' || f.status === 'TRANSFERRED_TO_DRIVER');
  const outstandingFinesCount = unpaidFines.length;
  const outstandingFinesSum = unpaidFines.reduce((sum, f) => sum + Number(f.amount), 0);

  // MTD Running Costs (Fuel + Maintenance + Fines MTD)
  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);

  const fuelCostMTD = fuelLogs
    .filter(log => new Date(log.log_date) >= currentMonthStart)
    .reduce((sum, log) => sum + Number(log.amount), 0);

  const maintCostMTD = maintenance
    .filter(m => new Date(m.service_date) >= currentMonthStart && m.status === 'COMPLETED')
    .reduce((sum, m) => sum + Number(m.cost), 0);

  const finesCostMTD = fines
    .filter(f => new Date(f.fine_date) >= currentMonthStart)
    .reduce((sum, f) => sum + Number(f.amount), 0);

  const totalMTDCosts = fuelCostMTD + maintCostMTD + finesCostMTD;

  // Upcoming Expiries (Registration/Mulkiya and Insurance within 30 days)
  const today = new Date();
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(today.getDate() + 30);

  const expiriesList = vehicles.filter(v => {
    const regExp = new Date(v.registration_expiry);
    const insExp = new Date(v.insurance_expiry);
    return (regExp <= thirtyDaysLater) || (insExp <= thirtyDaysLater);
  });

  // Critical Alert Expiries (Already expired + status ACTIVE = CRITICAL)
  const criticalAlertsCount = vehicles.filter(v => {
    if (v.status !== 'ACTIVE') return false;
    const regExp = new Date(v.registration_expiry);
    const insExp = new Date(v.insurance_expiry);
    return regExp < today || insExp < today;
  }).length;

  // Driver Black Points watchlist
  const driverPointsMap: Record<string, { name: string; points: number; vehicleCodes: string[] }> = {};
  fines.forEach(f => {
    if (f.driver_id && f.black_points > 0) {
      // Find fine driver name
      const driverName = f.driver_name || 'Attributed Driver';
      if (!driverPointsMap[f.driver_id]) {
        driverPointsMap[f.driver_id] = { name: driverName, points: 0, vehicleCodes: [] };
      }
      driverPointsMap[f.driver_id].points += f.black_points;
    }
  });
  const blackPointsWatchlist = Object.values(driverPointsMap)
    .filter(d => d.points >= 12)
    .sort((a, b) => b.points - a.points);

  // Next scheduled service list
  const upcomingServices = maintenance
    .filter(m => m.status === 'SCHEDULED' || m.status === 'IN_PROGRESS')
    .sort((a, b) => new Date(a.service_date).getTime() - new Date(b.service_date).getTime())
    .slice(0, 5);

  const getDaysRemainingStr = (dateStr: string) => {
    const expiry = new Date(dateStr);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: `Expired by ${Math.abs(diffDays)} days`, style: 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border border-[var(--status-danger-border)]' };
    if (diffDays === 0) return { text: 'Expires Today', style: 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border border-[var(--status-danger-border)] animate-pulse' };
    if (diffDays <= 7) return { text: `${diffDays} days left`, style: 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border border-[var(--status-danger-border)]' };
    if (diffDays <= 30) return { text: `${diffDays} days left`, style: 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border border-[var(--status-warning-border)]' };
    return { text: `${diffDays} days left`, style: 'bg-[var(--surface-hover)] text-[var(--text-secondary)] border border-[var(--border)]' };
  };

  const formatAED = (val: number) => {
    return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(val).replace('AED', '').trim() + ' AED';
  };

  return (
    <div className="min-h-screen bg-[var(--bg-dark)] text-[var(--text-primary)]">
<main className="max-w-[1600px] mx-auto px-6 py-8">
        
        {/* CRITICAL ALERTS BANNER */}
        {criticalAlertsCount > 0 && (
          <div className="mb-8 p-4 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-xl flex items-center justify-between shadow-[0_0_20px_rgba(239,68,68,0.08)]">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg flex items-center justify-center text-[var(--status-danger-text)] animate-pulse">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h2 className="font-heading font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider">
                  Critical Compliance Violation
                </h2>
                <p className="text-xs text-[var(--status-danger-text)] mt-0.5">
                  There are {criticalAlertsCount} ACTIVE vehicle(s) driving with expired Mulkiya registration or insurance. Renew immediately!
                </p>
              </div>
            </div>
            <Link 
              href="/fleet?status=ACTIVE" 
              className="text-xs font-bold text-[var(--text-primary)] bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] px-3 py-1.5 rounded-lg hover:bg-[var(--status-danger-bg)] transition-all font-mono uppercase tracking-wider"
              onClick={() => {
                setStatusFilter('ACTIVE');
                setSearchQuery('');
              }}
            >
              Resolve Expired
            </Link>
          </div>
        )}

        {/* PAGE HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-heading font-extrabold text-2xl tracking-tight text-[var(--text-primary)]">
              Fleet Management
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1 uppercase tracking-widest font-mono">
              Vehicle Logistics, UAE compliance & running cost ledger
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              href="/fleet/fines"
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--surface-hover)] transition-all"
            >
              <AlertTriangle size={14} className="text-[var(--status-warning-text)]" />
              Manage Fines
            </Link>
            <button 
              onClick={fetchData}
              className="p-2 bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-all"
              title="Refresh Data"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* KPI DASHBOARD */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* O1: Vehicles Status */}
          <div className="p-5 bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-color)] rounded-xl relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest font-mono">
                Total Vehicles
              </span>
              <Car size={16} className="text-[var(--primary)]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-heading font-extrabold text-[var(--text-primary)]">{totalVehicles}</span>
              <span className="text-xs text-[var(--text-muted)]">units</span>
            </div>
            <div className="flex items-center gap-3 mt-4 text-[10px] font-mono text-[var(--text-secondary)] border-t border-[var(--border)] pt-3">
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 bg-[var(--accent)] rounded-full"></span>
                <span>Active: {activeCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 bg-[var(--status-warning-bg)] rounded-full"></span>
                <span>Workshop: {workshopCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 bg-[var(--bg-card)] rounded-full"></span>
                <span>Off Road: {offRoadCount}</span>
              </div>
            </div>
          </div>

          {/* O2: MTD Running Cost */}
          <div className="p-5 bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-color)] rounded-xl relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest font-mono">
                Fleet Expenses MTD
              </span>
              <DollarSign size={16} className="text-[var(--accent)]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-heading font-extrabold text-[var(--text-primary)]">
                {formatAED(totalMTDCosts)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 text-[9px] font-mono text-[var(--text-secondary)] border-t border-[var(--border)] pt-3">
              <div>
                <span className="block text-[var(--text-muted)]">Fuel</span>
                <span className="font-bold text-[var(--text-secondary)]">{formatAED(fuelCostMTD)}</span>
              </div>
              <div>
                <span className="block text-[var(--text-muted)]">Service</span>
                <span className="font-bold text-[var(--text-secondary)]">{formatAED(maintCostMTD)}</span>
              </div>
              <div>
                <span className="block text-[var(--text-muted)]">Fines</span>
                <span className="font-bold text-[var(--text-secondary)]">{formatAED(finesCostMTD)}</span>
              </div>
            </div>
          </div>

          {/* O3: Outstanding Fines */}
          <div className="p-5 bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-color)] rounded-xl relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest font-mono">
                Fines Backlog
              </span>
              <AlertTriangle size={16} className="text-[var(--status-danger-text)]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-heading font-bold text-[var(--status-danger-text)]">
                {formatAED(outstandingFinesSum)}
              </span>
            </div>
            <div className="flex justify-between items-center mt-4 text-[10px] font-mono text-[var(--text-secondary)] border-t border-[var(--border)] pt-3">
              <span>Unpaid Violations:</span>
              <span className="text-[var(--status-danger-text)] font-bold">{outstandingFinesCount} fines</span>
            </div>
          </div>

          {/* O4: Renewals Due */}
          <div className="p-5 bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-color)] rounded-xl relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest font-mono">
                Renewals (30 Days)
              </span>
              <Calendar size={16} className="text-[var(--status-warning-text)]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-heading font-extrabold text-[var(--text-primary)]">{expiriesList.length}</span>
              <span className="text-xs text-[var(--text-muted)]">vehicles</span>
            </div>
            <div className="flex justify-between items-center mt-4 text-[10px] font-mono text-[var(--text-secondary)] border-t border-[var(--border)] pt-3">
              <span>Critical Overdue:</span>
              <span className={`font-bold ${criticalAlertsCount > 0 ? 'text-[var(--status-danger-text)]' : 'text-[var(--text-secondary)]'}`}>
                {criticalAlertsCount} active
              </span>
            </div>
          </div>
        </div>

        {/* SPLIT PANELS (Watchlists & Reminders) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
          {/* Expiry / Renewal Countdown list */}
          <div className="lg:col-span-2 p-5 bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-color)] rounded-xl flex flex-col h-[380px]">
            <h3 className="font-heading font-bold text-xs uppercase tracking-widest text-[var(--text-secondary)] mb-4 flex items-center gap-1.5">
              <Calendar size={13} className="text-[var(--status-warning-text)]" />
              UAE Registration & Insurance Expiries Pipeline
            </h3>
            <div className="overflow-y-auto flex-1 pr-1 gap-3 flex flex-col">
              {expiriesList.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)] font-mono">
                  No vehicle renewals due in the next 30 days.
                </div>
              ) : (
                expiriesList.map(v => {
                  const regDays = getDaysRemainingStr(v.registration_expiry);
                  const insDays = getDaysRemainingStr(v.insurance_expiry);
                  
                  return (
                    <div 
                      key={v.id}
                      className="p-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[var(--border)] transition-all"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--text-primary)]">{v.vehicle_code}</span>
                          <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--surface-hover)] px-1.5 py-0.5 rounded">
                            {v.plate_number}
                          </span>
                        </div>
                        <div className="text-[10px] text-[var(--text-secondary)] mt-1">
                          {v.make} {v.model} ({v.year})
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex flex-col sm:items-end">
                          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest block">Mulkiya (Reg)</span>
                          <span className={`mt-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded ${regDays.style}`}>
                            {regDays.text}
                          </span>
                        </div>
                        <div className="flex flex-col sm:items-end">
                          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest block">Insurance</span>
                          <span className={`mt-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded ${insDays.style}`}>
                            {insDays.text}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel: Driver points watchlist + Scheduled Services */}
          <div className="flex flex-col gap-6">
            
            {/* Driver points suspension risk */}
            <div className="p-5 bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-color)] rounded-xl flex flex-col h-[180px]">
              <h3 className="font-heading font-bold text-xs uppercase tracking-widest text-[var(--text-secondary)] mb-3 flex items-center gap-1.5">
                <Users size={13} className="text-[var(--status-danger-text)]" />
                License Black Points Watchlist (Sus. risk)
              </h3>
              <div className="overflow-y-auto flex-1 pr-1">
                {blackPointsWatchlist.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)] font-mono">
                    No drivers at risk (12+ points).
                  </div>
                ) : (
                  <div className="gap-2 flex flex-col">
                    {blackPointsWatchlist.map((d: any) => (
                      <div key={d.name} className="flex justify-between items-center text-xs p-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg">
                        <div>
                          <div className="font-semibold text-[var(--text-primary)]">{d.name}</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-[var(--text-secondary)]">Total:</span>
                          <span className={`font-bold font-mono text-sm ${d.points >= 22 ? 'text-[var(--status-danger-text)] animate-pulse' : d.points >= 18 ? 'text-[var(--status-danger-text)]' : 'text-[var(--status-warning-text)]'}`}>
                            {d.points} / 24
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Scheduled Service Due list */}
            <div className="p-5 bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-color)] rounded-xl flex flex-col h-[174px]">
              <h3 className="font-heading font-bold text-xs uppercase tracking-widest text-[var(--text-secondary)] mb-3 flex items-center gap-1.5">
                <Wrench size={13} className="text-[var(--primary)]" />
                Service Due & Maintenance Schedules
              </h3>
              <div className="overflow-y-auto flex-1 pr-1">
                {upcomingServices.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)] font-mono">
                    No upcoming services scheduled.
                  </div>
                ) : (
                  <div className="gap-2 flex flex-col">
                    {upcomingServices.map(m => (
                      <div key={m.id} className="flex justify-between items-center text-xs p-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg">
                        <div>
                          <div className="font-bold text-[var(--text-secondary)]">Vehicle: {m.vehicle_code}</div>
                          <div className="text-[9px] text-[var(--text-muted)] mt-0.5">{m.description}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-[10px] text-[var(--text-secondary)]">
                            {new Date(m.service_date).toLocaleDateString('en-GB')}
                          </div>
                          <div className="text-[9px] font-mono text-[var(--primary)] uppercase mt-0.5">
                            {m.status}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>

        {/* VEHICLE LIST SECTION */}
        <div className="p-6 bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-color)] rounded-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="font-heading font-extrabold text-sm uppercase tracking-wider text-[var(--text-primary)]">
              Active Fleet Directory ({filteredVehicles.length} vehicles)
            </h3>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input 
                  type="text"
                  placeholder="Search code, plate, driver..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-56 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg pl-9 pr-4 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--primary)] transition-all"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--primary)]"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="IN_WORKSHOP">In Workshop</option>
                <option value="OFF_ROAD">Off Road</option>
              </select>

              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-secondary)] focus:outline-none focus:border-[var(--primary)]"
              >
                <option value="">All Types</option>
                <option value="PICKUP">Pickup</option>
                <option value="VAN">Van</option>
                <option value="CAR">Car</option>
                <option value="TRUCK">Truck</option>
                <option value="BUS">Bus</option>
                <option value="LIFT_MACHINE">Lift/Machine</option>
              </select>
            </div>
          </div>

          {/* Grid table list */}
          {loading ? (
            <div className="h-60 flex items-center justify-center text-xs font-mono text-[var(--text-muted)]">
              <RefreshCw className="animate-spin mr-2" size={15} /> Loading vehicles ledger...
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-xs font-mono text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-lg">
              No vehicles matched your search query.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">
                    <th className="pb-3 font-medium">Vehicle Code</th>
                    <th className="pb-3 font-medium">Plate Number</th>
                    <th className="pb-3 font-medium">Emirate</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Model Specs</th>
                    <th className="pb-3 font-medium">Odometer</th>
                    <th className="pb-3 font-medium">Assigned Driver</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-xs">
                  {filteredVehicles.map(v => (
                    <tr key={v.id} className="hover:bg-[var(--surface-hover)] group">
                      <td className="py-4 font-bold font-mono text-[var(--primary)]">
                        {v.vehicle_code}
                      </td>
                      <td className="py-4">
                        <span className="font-mono bg-[var(--bg-card)] px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text-secondary)]">
                          {v.plate_number}
                        </span>
                      </td>
                      <td className="py-4 text-[var(--text-secondary)] font-mono text-[10px]">
                        {v.plate_emirate}
                      </td>
                      <td className="py-4 text-[var(--text-secondary)]">
                        {v.vehicle_type}
                      </td>
                      <td className="py-4">
                        <span className="font-semibold text-[var(--text-primary)]">{v.make} {v.model}</span>
                        <span className="text-[10px] text-[var(--text-muted)] ml-1">({v.year})</span>
                      </td>
                      <td className="py-4 font-mono font-semibold text-[var(--text-secondary)]">
                        {v.odometer_km.toLocaleString('en-US')} km
                      </td>
                      <td className="py-4">
                        {v.driver_name ? (
                          <span className="flex items-center gap-1 text-[var(--text-secondary)]">
                            <span className="h-1.5 w-1.5 bg-[var(--accent)] rounded-full"></span>
                            {v.driver_name}
                          </span>
                        ) : (
                          <span className="text-[var(--text-tertiary)] italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider font-bold ${
                          v.status === 'ACTIVE' 
                            ? 'bg-[var(--accent-glow)] text-[var(--accent)] border border-[var(--accent)]' 
                            : v.status === 'IN_WORKSHOP'
                            ? 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border border-[var(--status-warning-border)]'
                            : 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border border-[var(--status-danger-border)]'
                        }`}>
                          {v.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <Link
                          href={`/fleet/${v.id}`}
                          className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] group-hover:text-[var(--primary)] font-bold transition-all"
                        >
                          Workspace
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

      </main>
    </div>
  );
}
