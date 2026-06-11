// ============================================================
// JEET ERP — Timesheet Week Log Dashboard
// Route: /timesheets
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Save, 
  Send, 
  Copy, 
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTimesheet } from '@/hooks/useTimesheet';
import { timesheetService } from '@/services/timesheetService';
import type { Employee } from '@/types/hr.types';
import type { TimesheetEntry, AllocationType, OvertimeType } from '@/types/timesheet.types';
import './timesheets.css';

// Helper to get Sunday of the current week (YYYY-MM-DD format)
function getSundayDate(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // Sunday is 0
  const diff = d.getDate() - day;
  const sunday = new Date(d.setDate(diff));
  return sunday.toISOString().split('T')[0];
}

// Add days to date string and return YYYY-MM-DD
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

interface TimesheetRow {
  id: string; // client-side temp id
  allocation_type: AllocationType;
  project_id: string;
  ticket_id: string;
  visit_id: string;
  description: string;
  is_overtime: boolean;
  ot_type: OvertimeType | '';
  hours: number[]; // 7 elements, index 0=Sunday, ..., 6=Saturday
}

export default function MyTimesheetPage() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [employeeLoading, setEmployeeLoading] = useState(true);
  
  // Selected week start date (always Sunday)
  const [weekStart, setWeekStart] = useState<string>(() => getSundayDate(new Date()));
  
  const [projects, setProjects] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  // Load employee profile matched to the current logged-in user
  useEffect(() => {
    async function loadProfile() {
      try {
        setEmployeeLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data: emp, error } = await supabase
          .from('employees')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();
          
        if (error) throw error;
        setEmployee(emp);
      } catch (err) {
        console.error('Error fetching employee profile:', err);
      } finally {
        setEmployeeLoading(false);
      }
    }
    loadProfile();
  }, []);

  // Hook for timesheet operations
  const { 
    timesheet, 
    entries, 
    loading, 
    error, 
    refetch, 
    saveEntries, 
    submit 
  } = useTimesheet(employee?.id || undefined, weekStart);

  // Table rows state representation for editing
  const [rows, setRows] = useState<TimesheetRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch reference lookup lists
  useEffect(() => {
    async function fetchLookups() {
      const [
        { data: projData },
        { data: tickData },
        { data: visitData }
      ] = await Promise.all([
        supabase.from('projects').select('id, name, project_number').order('name'),
        supabase.from('service_tickets').select('id, ticket_number, title').order('created_at', { ascending: false }).limit(50),
        supabase.from('ppm_visits').select('id, visit_number, summary').order('scheduled_date', { ascending: false }).limit(50)
      ]);
      setProjects(projData || []);
      setTickets(tickData || []);
      setVisits(visitData || []);
    }
    fetchLookups();
  }, []);

  // Load suggestions
  const loadSuggestions = useCallback(async () => {
    if (!employee?.id) return;
    try {
      setSuggestionsLoading(true);
      const list = await timesheetService.getPrefillSuggestions(employee.id, weekStart);
      setSuggestions(list);
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    } finally {
      setSuggestionsLoading(false);
    }
  }, [employee?.id, weekStart]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  // Sync db entries to UI table rows
  useEffect(() => {
    if (!entries || entries.length === 0) {
      // Initialize with one blank row if empty and in draft mode
      if (timesheet?.status === 'DRAFT' || !timesheet) {
        setRows([createBlankRow()]);
      } else {
        setRows([]);
      }
      return;
    }

    // Group entries into rows by allocation + options
    const rowMap: Record<string, TimesheetRow> = {};
    
    entries.forEach(entry => {
      const key = `${entry.allocation_type}-${entry.project_id || ''}-${entry.ticket_id || ''}-${entry.visit_id || ''}-${entry.is_overtime}-${entry.ot_type || ''}-${entry.description || ''}`;
      
      const workDate = new Date(entry.work_date);
      const dayIndex = workDate.getDay(); // 0=Sunday, 1=Monday, ...

      if (!rowMap[key]) {
        rowMap[key] = {
          id: key,
          allocation_type: entry.allocation_type,
          project_id: entry.project_id || '',
          ticket_id: entry.ticket_id || '',
          visit_id: entry.visit_id || '',
          description: entry.description || '',
          is_overtime: entry.is_overtime,
          ot_type: entry.ot_type || '',
          hours: [0, 0, 0, 0, 0, 0, 0]
        };
      }
      
      rowMap[key].hours[dayIndex] = Number(entry.hours);
    });

    setRows(Object.values(rowMap));
  }, [entries, timesheet]);

  function createBlankRow(): TimesheetRow {
    return {
      id: Math.random().toString(),
      allocation_type: 'PROJECT',
      project_id: '',
      ticket_id: '',
      visit_id: '',
      description: '',
      is_overtime: false,
      ot_type: '',
      hours: [0, 0, 0, 0, 0, 0, 0]
    };
  }

  // Add row
  const addRow = () => {
    setRows(prev => [...prev, createBlankRow()]);
  };

  // Remove row
  const removeRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
  };

  // Update row field
  const updateRowField = (id: string, field: keyof TimesheetRow, value: any) => {
    setRows(prev => prev.map(r => {
      if (r.id === id) {
        // Clear fields when allocation type changes
        if (field === 'allocation_type') {
          return {
            ...r,
            allocation_type: value,
            project_id: '',
            ticket_id: '',
            visit_id: '',
            description: ''
          };
        }
        return { ...r, [field]: value };
      }
      return r;
    }));
  };

  // Update daily hours input
  const updateRowHours = (id: string, dayIndex: number, hoursVal: string) => {
    const parsed = Math.max(0, Math.min(24, Number(hoursVal) || 0));
    setRows(prev => prev.map(r => {
      if (r.id === id) {
        const newHours = [...r.hours];
        newHours[dayIndex] = parsed;
        return { ...r, hours: newHours };
      }
      return r;
    }));
  };

  // Navigation week shifting
  const shiftWeek = (weeks: number) => {
    const current = new Date(weekStart);
    current.setDate(current.getDate() + (weeks * 7));
    setWeekStart(getSundayDate(current));
  };

  // Apply suggestion
  const applySuggestion = (sug: any) => {
    const sugDate = new Date(sug.work_date);
    const dayIndex = sugDate.getDay();

    // Check if row already exists for this type/id combination
    setRows(prev => {
      const matchIndex = prev.findIndex(r => 
        r.allocation_type === sug.allocation_type &&
        (sug.project_id ? r.project_id === sug.project_id : true) &&
        (sug.ticket_id ? r.ticket_id === sug.ticket_id : true) &&
        (sug.visit_id ? r.visit_id === sug.visit_id : true) &&
        !r.is_overtime
      );

      if (matchIndex > -1) {
        const updated = [...prev];
        updated[matchIndex].hours[dayIndex] = sug.hours;
        return updated;
      } else {
        const newRow = createBlankRow();
        newRow.allocation_type = sug.allocation_type;
        newRow.project_id = sug.project_id || '';
        newRow.ticket_id = sug.ticket_id || '';
        newRow.visit_id = sug.visit_id || '';
        newRow.description = sug.description || '';
        newRow.hours[dayIndex] = sug.hours;
        return [...prev, newRow];
      }
    });
  };

  // Copy Last Week
  const handleCopyLastWeek = async () => {
    if (!employee?.id) return;
    try {
      const lastWeekStart = addDays(weekStart, -7);
      const { entries: prevEntries } = await timesheetService.getTimesheet(employee.id, lastWeekStart);
      
      if (!prevEntries || prevEntries.length === 0) {
        alert('No timesheet entries found in the previous week.');
        return;
      }

      // Group allocations from previous week (with hours reset to 0)
      const copiedMap: Record<string, TimesheetRow> = {};
      prevEntries.forEach(entry => {
        const key = `${entry.allocation_type}-${entry.project_id || ''}-${entry.ticket_id || ''}-${entry.visit_id || ''}-${entry.is_overtime}-${entry.ot_type || ''}-${entry.description || ''}`;
        
        if (!copiedMap[key]) {
          copiedMap[key] = {
            id: Math.random().toString(),
            allocation_type: entry.allocation_type,
            project_id: entry.project_id || '',
            ticket_id: entry.ticket_id || '',
            visit_id: entry.visit_id || '',
            description: entry.description || '',
            is_overtime: entry.is_overtime,
            ot_type: entry.ot_type || '',
            hours: [0, 0, 0, 0, 0, 0, 0]
          };
        }
      });

      setRows(Object.values(copiedMap));
    } catch (err: any) {
      alert(`Copy failed: ${err.message || err}`);
    }
  };

  // Convert row-based state into single entry list for DB saving
  const handleSave = async (isSubmit = false) => {
    if (!employee?.id) return;
    
    // Validate rows
    for (const row of rows) {
      if (row.allocation_type === 'PROJECT' && !row.project_id) {
        alert('Please select a project for project-allocated rows.');
        return;
      }
      if (row.allocation_type === 'SERVICE_TICKET' && !row.ticket_id) {
        alert('Please select a service ticket.');
        return;
      }
      if (row.allocation_type === 'PPM_VISIT' && !row.visit_id) {
        alert('Please select a PPM visit.');
        return;
      }
      if (row.is_overtime && !row.ot_type) {
        alert('Please select an overtime multiplier type (Weekday/Restday/Holiday).');
        return;
      }
    }

    // Flatten rows into entries
    const dbEntries: Omit<TimesheetEntry, 'id' | 'timesheet_id' | 'created_at'>[] = [];
    
    rows.forEach(row => {
      row.hours.forEach((h, dayIndex) => {
        if (h > 0) {
          const dateStr = addDays(weekStart, dayIndex);
          dbEntries.push({
            work_date: dateStr,
            allocation_type: row.allocation_type,
            project_id: row.project_id || null,
            ticket_id: row.ticket_id || null,
            visit_id: row.visit_id || null,
            hours: h,
            is_overtime: row.is_overtime,
            ot_type: row.is_overtime ? (row.ot_type as OvertimeType) : null,
            description: row.description || null,
            site_location: null
          });
        }
      });
    });

    try {
      if (isSubmit) {
        setSubmitting(true);
      } else {
        setSaving(true);
      }

      // 1. Save all entries
      await saveEntries(dbEntries);

      // 2. Submit if requested
      if (isSubmit) {
        await submit();
        alert('Timesheet submitted successfully for approval.');
      } else {
        alert('Draft timesheet saved successfully.');
      }
      
      refetch();
    } catch (err: any) {
      alert(`Save failed: ${err.message || err}`);
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  };

  // Calculate Column Totals
  const colTotals = Array.from({ length: 7 }, (_, dayIndex) => {
    return rows.reduce((acc, row) => acc + (row.hours[dayIndex] || 0), 0);
  });

  const grandTotal = colTotals.reduce((a, b) => a + b, 0);

  // UAE Weekend markers (Friday index 5, Saturday index 6)
  const daysMeta = [
    { name: 'Sun', label: 'Sunday' },
    { name: 'Mon', label: 'Monday' },
    { name: 'Tue', label: 'Tuesday' },
    { name: 'Wed', label: 'Wednesday' },
    { name: 'Thu', label: 'Thursday' },
    { name: 'Fri', label: 'Friday', weekend: true },
    { name: 'Sat', label: 'Saturday', weekend: true }
  ];

  const isDisabled = !!(timesheet && timesheet.status !== 'DRAFT' && timesheet.status !== 'REJECTED');

  if (employeeLoading) {
    return (
      <div className="quote-container">
        <div style={{ padding: '6rem', textAlign: 'center' }} className="quote-card">
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
          <p>Verifying workforce session credentials...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="quote-container">
        <div className="quote-card border-red-900/50" style={{ padding: '3rem', textAlign: 'center' }}>
          <AlertTriangle size={48} className="text-red-500" style={{ margin: '0 auto 1.5rem auto' }} />
          <h2 className="font-mono text-xs uppercase tracking-widest text-slate-100 font-bold mb-2">No Employee Profile Linked</h2>
          <p className="text-[12px] text-slate-400 max-w-md mx-auto mb-6">
            Your login user ID does not map to any employee record in the Employee Master. Please ask an administrator or HR representative to onboard your employee profile and link your user credentials.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="quote-container">
      {/* Header */}
      <header className="quote-header">
        <div>
          <h1 className="quote-header-title">My Timesheet Log</h1>
          <p className="quote-header-subtitle">
            Logged as: <strong className="text-slate-200">{employee.full_name_en}</strong> ({employee.employee_number})
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          {/* Sub Navigation Links */}
          <Link href="/timesheets/approvals" className="quote-btn quote-btn-secondary" style={{ textDecoration: 'none', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <CheckCircle size={14} /> Approvals Board
          </Link>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.2rem 0.5rem' }}>
            <button className="quote-btn" style={{ padding: '0.2rem 0.4rem', border: 'none', background: 'transparent' }} onClick={() => shiftWeek(-1)}>
              <ChevronLeft size={14} />
            </button>
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200" style={{ minWidth: '180px', textAlign: 'center' }}>
              Week of {new Date(weekStart).toLocaleDateString('en-GB')}
            </span>
            <button className="quote-btn" style={{ padding: '0.2rem 0.4rem', border: 'none', background: 'transparent' }} onClick={() => shiftWeek(1)}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Rejection Alert */}
      {timesheet?.status === 'REJECTED' && (
        <div className="overhead-warning-banner" style={{ marginBottom: '1.5rem', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--error)' }}>
          <AlertTriangle size={18} />
          <div>
            <strong>Timesheet Rejected:</strong> {timesheet.rejection_reason || 'No details provided.'} Please edit the allocations below and re-submit.
          </div>
        </div>
      )}

      {/* Stats Cards Row */}
      <div className="timesheet-header-stats mb-6">
        <div className="timesheet-stat-card">
          <div>
            <span className="timesheet-stat-lbl">Regular Hours</span>
            <span className="timesheet-stat-val block mt-1">
              {timesheet?.total_regular_hours || 0}
            </span>
          </div>
          <Clock className="text-emerald-400" size={24} />
        </div>
        <div className="timesheet-stat-card">
          <div>
            <span className="timesheet-stat-lbl">Overtime Hours</span>
            <span className="timesheet-stat-val block mt-1 text-cyan-400">
              {timesheet?.total_ot_hours || 0}
            </span>
          </div>
          <Sparkles className="text-cyan-400" size={24} />
        </div>
        <div className="timesheet-stat-card">
          <div>
            <span className="timesheet-stat-lbl">Total Logged</span>
            <span className="timesheet-stat-val block mt-1">
              {grandTotal} hrs
            </span>
          </div>
          <Info className="text-slate-400" size={24} />
        </div>
        <div className="timesheet-stat-card">
          <div>
            <span className="timesheet-stat-lbl">Status</span>
            <span className={`badge-status block mt-2 text-center ${timesheet?.status.toLowerCase() || 'draft'}`}>
              {timesheet?.status || 'NOT CREATED'}
            </span>
          </div>
        </div>
      </div>

      {/* Prefill Suggestions Banner */}
      {!isDisabled && suggestions.length > 0 && (
        <div className="suggestion-banner">
          <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[10px] uppercase font-bold">
            <Sparkles size={12} /> Auto-Suggestions from Completed Operations
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
            {suggestions.map((sug, i) => (
              <div key={i} className="suggestion-pill">
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="text-[10px] text-slate-300 font-semibold">{sug.description}</span>
                  <span className="font-mono text-[9px] text-slate-500">
                    {new Date(sug.work_date).toLocaleDateString('en-GB')} — {sug.allocation_type.replace('_', ' ')}
                  </span>
                </div>
                <button 
                  type="button" 
                  className="quote-btn quote-btn-primary" 
                  style={{ padding: '0.2rem 0.5rem', fontSize: '9px' }} 
                  onClick={() => applySuggestion(sug)}
                >
                  Log {sug.hours}h
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid Card */}
      <div className="timesheet-card">
        {/* Table Headers */}
        <div className="timesheet-row-grid header">
          <div>Allocation Type</div>
          <div>Project Allocation</div>
          <div>Ticket / Visit</div>
          <div>Task Description</div>
          {daysMeta.map((day, i) => {
            const dateStr = addDays(weekStart, i);
            const dateObj = new Date(dateStr);
            return (
              <div key={i} className="timesheet-day-label">
                <span className="timesheet-day-name">{day.name}</span>
                <span className={`timesheet-day-date ${day.weekend ? 'weekend' : ''}`}>
                  {dateObj.getDate()}/{dateObj.getMonth() + 1}
                </span>
              </div>
            );
          })}
          <div style={{ textAlign: 'center' }}>Total</div>
        </div>

        {/* Rows */}
        {rows.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No allocation lines logged. Click "Add Allocation Row" to begin.
          </div>
        ) : (
          <div className="space-y-1 my-2">
            {rows.map((row) => {
              const rowTotal = row.hours.reduce((a, b) => a + b, 0);
              
              return (
                <div key={row.id} className="timesheet-row-grid">
                  {/* Allocation Type */}
                  <div>
                    <select
                      className="timesheet-select-allocation"
                      value={row.allocation_type}
                      onChange={(e) => updateRowField(row.id, 'allocation_type', e.target.value)}
                      disabled={isDisabled}
                    >
                      <option value="PROJECT">Project Site</option>
                      <option value="SERVICE_TICKET">Service Ticket</option>
                      <option value="PPM_VISIT">PPM Visit</option>
                      <option value="OVERHEAD">Company Overhead</option>
                      <option value="LEAVE">Leave / Holiday</option>
                    </select>
                  </div>

                  {/* Project Selector */}
                  <div>
                    {row.allocation_type === 'PROJECT' ? (
                      <select
                        className="timesheet-select-allocation"
                        value={row.project_id}
                        onChange={(e) => updateRowField(row.id, 'project_id', e.target.value)}
                        disabled={isDisabled}
                      >
                        <option value="">-- Project --</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[10px] text-slate-600 italic font-mono block text-center">N/A</span>
                    )}
                  </div>

                  {/* Ticket/Visit Selector */}
                  <div>
                    {row.allocation_type === 'SERVICE_TICKET' ? (
                      <select
                        className="timesheet-select-allocation"
                        value={row.ticket_id}
                        onChange={(e) => updateRowField(row.id, 'ticket_id', e.target.value)}
                        disabled={isDisabled}
                      >
                        <option value="">-- Ticket --</option>
                        {tickets.map(t => (
                          <option key={t.id} value={t.id}>{t.ticket_number}</option>
                        ))}
                      </select>
                    ) : row.allocation_type === 'PPM_VISIT' ? (
                      <select
                        className="timesheet-select-allocation"
                        value={row.visit_id}
                        onChange={(e) => updateRowField(row.id, 'visit_id', e.target.value)}
                        disabled={isDisabled}
                      >
                        <option value="">-- PPM Visit --</option>
                        {visits.map(v => (
                          <option key={v.id} value={v.id}>{v.visit_number}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[10px] text-slate-600 italic font-mono block text-center">N/A</span>
                    )}
                  </div>

                  {/* Description / Site details */}
                  <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="timesheet-input-hours text-left text-[11px]"
                      placeholder="Tasks performed..."
                      value={row.description}
                      onChange={(e) => updateRowField(row.id, 'description', e.target.value)}
                      disabled={isDisabled}
                      style={{ paddingLeft: '0.4rem', textTransform: 'none', fontFamily: 'inherit' }}
                    />
                    
                    {/* Overtime Selector */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginLeft: '4px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '8px', cursor: 'pointer' }} className="font-mono text-slate-400">
                        <input
                          type="checkbox"
                          checked={row.is_overtime}
                          onChange={(e) => {
                            updateRowField(row.id, 'is_overtime', e.target.checked);
                            if (!e.target.checked) updateRowField(row.id, 'ot_type', '');
                          }}
                          disabled={isDisabled}
                        />
                        OT
                      </label>
                      {row.is_overtime && (
                        <select
                          className="font-mono text-[8px] bg-slate-900 border border-slate-700 text-cyan-400 rounded outline-none"
                          style={{ padding: '1px' }}
                          value={row.ot_type}
                          onChange={(e) => updateRowField(row.id, 'ot_type', e.target.value)}
                          disabled={isDisabled}
                        >
                          <option value="">-- OT --</option>
                          <option value="WEEKDAY_OT">1.25x</option>
                          <option value="RESTDAY_OT">1.5x</option>
                          <option value="HOLIDAY_OT">1.5x</option>
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Daily input hours */}
                  {row.hours.map((hr, idx) => (
                    <div key={idx}>
                      <input
                        type="number"
                        min="0"
                        max="24"
                        step="0.5"
                        className={`timesheet-input-hours ${row.is_overtime ? 'ot-active' : ''}`}
                        value={hr === 0 ? '' : hr}
                        onChange={(e) => updateRowHours(row.id, idx, e.target.value)}
                        disabled={isDisabled}
                      />
                    </div>
                  ))}

                  {/* Row Total & Delete Button */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="font-mono text-xs font-bold text-slate-300">{rowTotal}</span>
                    {!isDisabled && (
                      <button 
                        type="button" 
                        className="text-slate-500 hover:text-red-400"
                        style={{ border: 'none', background: 'transparent' }}
                        onClick={() => removeRow(row.id)}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Sum Grid */}
        <div className="timesheet-row-grid" style={{ borderTop: '2px solid var(--border-color)', borderBottom: 'none', marginTop: '1rem', fontWeight: 'bold' }}>
          <div style={{ gridColumn: 'span 4' }} className="font-mono text-slate-400 uppercase text-[10px] tracking-wide">
            Daily Consolidated Totals
          </div>
          {colTotals.map((tot, idx) => (
            <div key={idx} className="font-mono text-center text-xs text-slate-200">
              {tot}
            </div>
          ))}
          <div style={{ textAlign: 'center' }} className="font-mono text-emerald-400 text-sm">
            {grandTotal}
          </div>
        </div>

        {/* Action Buttons */}
        {!isDisabled && (
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-900">
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button 
                type="button" 
                className="quote-btn quote-btn-secondary flex items-center gap-1.5"
                onClick={addRow}
              >
                <Plus size={14} /> Add Allocation Row
              </button>
              <button 
                type="button" 
                className="quote-btn quote-btn-secondary flex items-center gap-1.5"
                onClick={handleCopyLastWeek}
              >
                <Copy size={14} /> Copy allocations From Last Week
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button 
                type="button" 
                className="quote-btn quote-btn-secondary flex items-center gap-1.5"
                onClick={() => handleSave(false)}
                disabled={saving}
              >
                <Save size={14} /> {saving ? 'Saving...' : 'Save Draft'}
              </button>
              <button 
                type="button" 
                className="quote-btn quote-btn-primary flex items-center gap-1.5"
                onClick={() => handleSave(true)}
                disabled={submitting}
              >
                <Send size={14} /> {submitting ? 'Submitting...' : 'Submit for approval'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
