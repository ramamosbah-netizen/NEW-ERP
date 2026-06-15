// ============================================================
// JEET ERP — Team Capacity Leave Swimlane Calendar
// Route: /hr/calendar
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  Briefcase,
  Users,
  RefreshCw,
  Info
} from 'lucide-react';
import { leaveService } from '@/services/leaveService';
import { employeeService } from '@/services/employeeService';
import type { Employee } from '@/types/hr.types';
import '../hr.css';

export default function LeaveCalendarPage() {
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const d = new Date();
    // Default to first day of current month
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed
  
  // Calculate days in the selected month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Format month name
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  // Get date range strings for querying
  const startDateStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [empList, leaveList] = await Promise.all([
        employeeService.getEmployees(),
        leaveService.getLeaveCalendar(startDateStr, endDateStr)
      ]);

      setEmployees(empList);
      setLeaves(leaveList);
    } catch (err: any) {
      console.error('Failed to load leave calendar data:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDateStr, endDateStr]);

  // Map leaves by employee ID
  const leavesByEmployee: Record<string, any[]> = {};
  leaves.forEach(l => {
    const empId = l.employee?.id;
    if (empId) {
      if (!leavesByEmployee[empId]) {
        leavesByEmployee[empId] = [];
      }
      leavesByEmployee[empId].push(l);
    }
  });

  // Check if a specific date (year, month, day) is a weekend (Fri/Sat in UAE)
  const isUAEWeekend = (dayNum: number) => {
    const d = new Date(year, month, dayNum);
    const dayOfWeek = d.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
    return dayOfWeek === 5 || dayOfWeek === 6;
  };

  // Get day of week abbreviation (S, M, T, W, T, F, S)
  const getDayAbbreviation = (dayNum: number) => {
    const d = new Date(year, month, dayNum);
    return d.toLocaleString('default', { weekday: 'narrow' });
  };

  return (
    <div className="quote-container">
      {/* Header */}
      <header className="quote-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Link href="/hr" className="text-[var(--text-secondary)] hover:text-[var(--accent)] font-mono text-[10px] uppercase flex items-center gap-1" style={{ textDecoration: 'none' }}>
              <ArrowLeft size={10} /> Back to Master
            </Link>
          </div>
          <h1 className="quote-header-title">Workforce capacity Leave Calendar</h1>
          <p className="quote-header-subtitle">Swimlane team schedule mapping approved leaves for capacity planning</p>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.2rem 0.5rem' }}>
            <button className="quote-btn" style={{ padding: '0.2rem 0.4rem', border: 'none', background: 'transparent' }} onClick={prevMonth}>
              <ChevronLeft size={14} />
            </button>
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]" style={{ minWidth: '100px', textAlign: 'center' }}>
              {monthName} {year}
            </span>
            <button className="quote-btn" style={{ padding: '0.2rem 0.4rem', border: 'none', background: 'transparent' }} onClick={nextMonth}>
              <ChevronRight size={14} />
            </button>
          </div>
          <button className="quote-btn quote-btn-secondary" onClick={loadData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Legend */}
      <div className="quote-card mb-4" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div className="compliance-light green" style={{ width: '10px', height: '10px' }} />
            <span className="text-[var(--text-secondary)]">Annual Leave</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div className="compliance-light amber" style={{ width: '10px', height: '10px' }} />
            <span className="text-[var(--text-secondary)]">Sick Leave</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div className="compliance-light red" style={{ width: '10px', height: '10px' }} />
            <span className="text-[var(--text-secondary)]">Unpaid Leave</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{ width: '10px', height: '10px', background: 'rgba(34, 211, 238, 0.2)', border: '1px solid var(--secondary)', borderRadius: '2px' }} />
            <span className="text-[var(--text-secondary)]">Other Leaves</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}>
            <Info size={12} className="text-[var(--text-primary)]0" />
            <span className="text-[var(--text-primary)]0">UAE weekends (Friday & Saturday) are highlighted in dark shading</span>
          </div>
        </div>
      </div>

      {/* Swimlanes Chart */}
      <div className="quote-card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Calendar Header Row */}
        <div className="swimlane-row" style={{ borderBottom: '2px solid var(--border-color)', background: 'rgba(13, 17, 39, 0.8)', minHeight: '38px' }}>
          <div className="swimlane-label font-mono uppercase text-[var(--text-secondary)] font-bold" style={{ borderRight: '1px solid var(--border-color)', fontSize: '10px' }}>
            Staff Member
          </div>
          <div className="swimlane-days" style={{ gridTemplateColumns: `repeat(${daysInMonth}, 1fr)` }}>
            {daysArray.map(day => {
              const isWeekend = isUAEWeekend(day);
              const dayAbbrev = getDayAbbreviation(day);
              return (
                <div 
                  key={day} 
                  className={`swimlane-day-cell flex flex-col items-center justify-center ${isWeekend ? 'weekend' : ''}`}
                  style={{ 
                    borderRight: '1px solid var(--border)',
                    padding: '4px 0',
                    background: isWeekend ? 'rgba(0, 0, 0, 0.3)' : 'transparent'
                  }}
                >
                  <span className="text-[var(--text-primary)]0 font-bold text-[8px]">{dayAbbrev}</span>
                  <span className="font-bold text-[9px] mt-0.5 text-[var(--text-secondary)]">{day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Calendar Body (Rows per employee) */}
        {loading ? (
          <div style={{ padding: '6rem', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
            <p>Compiling team schedule and swimlane metrics...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#ef4444' }}>
            <p>Failed to compile calendar: {error.message}</p>
          </div>
        ) : employees.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={32} style={{ margin: '0 auto 1rem auto', opacity: 0.3 }} />
            <p>No active employees registered in the system.</p>
          </div>
        ) : (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {employees.map(emp => {
              const empLeaves = leavesByEmployee[emp.id] || [];
              
              return (
                <div key={emp.id} className="swimlane-row">
                  {/* Left Column: Employee Info */}
                  <div className="swimlane-label flex-col items-start justify-center gap-0.5" style={{ padding: '8px 12px' }}>
                    <Link 
                      href={`/hr/${emp.id}`} 
                      className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] text-[11px] block truncate max-w-[150px]"
                      style={{ textDecoration: 'none' }}
                      title={emp.full_name_en}
                    >
                      {emp.full_name_en}
                    </Link>
                    <span className="font-mono text-[9px] text-[var(--text-primary)]0 uppercase tracking-tight block">
                      {emp.designation}
                    </span>
                  </div>

                  {/* Right Column: Calendar Grid with Overlaid Leaves */}
                  <div className="swimlane-days" style={{ gridTemplateColumns: `repeat(${daysInMonth}, 1fr)`, minHeight: '48px' }}>
                    {/* Render background grid cells */}
                    {daysArray.map(day => {
                      const isWeekend = isUAEWeekend(day);
                      return (
                        <div 
                          key={day} 
                          className={`swimlane-day-cell ${isWeekend ? 'weekend' : ''}`}
                          style={{ 
                            borderRight: '1px solid var(--border)',
                            background: isWeekend ? 'rgba(0, 0, 0, 0.15)' : 'transparent'
                          }}
                        />
                      );
                    })}

                    {/* Render leave bars */}
                    {empLeaves.map(leave => {
                      // Calculate grid columns span
                      const fromDate = new Date(leave.from_date);
                      const toDate = new Date(leave.to_date);

                      // Determine start day in the current month
                      let startCol = 1;
                      if (fromDate.getFullYear() === year && fromDate.getMonth() === month) {
                        startCol = fromDate.getDate();
                      }

                      // Determine end day in the current month
                      let endCol = daysInMonth;
                      if (toDate.getFullYear() === year && toDate.getMonth() === month) {
                        endCol = toDate.getDate();
                      }

                      // Only draw if spans overlap the current month
                      if (startCol <= daysInMonth && endCol >= 1) {
                        // Class styling based on leave type
                        let leaveClass = '';
                        let customStyle = {};

                        if (leave.leave_type === 'ANNUAL') {
                          leaveClass = '';
                          customStyle = {
                            background: 'rgba(16, 185, 129, 0.15)',
                            borderColor: 'var(--success)',
                            color: 'var(--success)',
                          };
                        } else if (leave.leave_type === 'SICK') {
                          leaveClass = 'sick'; // defined in hr.css (reddish)
                          customStyle = {
                            background: 'rgba(245, 158, 11, 0.15)',
                            borderColor: 'var(--warning)',
                            color: 'var(--warning)',
                          };
                        } else if (leave.leave_type === 'UNPAID') {
                          leaveClass = 'unpaid'; // defined in hr.css
                          customStyle = {
                            background: 'rgba(239, 68, 68, 0.15)',
                            borderColor: 'var(--error)',
                            color: 'var(--error)',
                          };
                        } else {
                          customStyle = {
                            background: 'rgba(34, 211, 238, 0.15)',
                            borderColor: 'var(--secondary)',
                            color: 'var(--secondary)',
                          };
                        }

                        return (
                          <div
                            key={leave.id}
                            className={`swimlane-bar ${leaveClass}`}
                            style={{
                              position: 'absolute',
                              top: '12px',
                              height: '24px',
                              alignSelf: 'center',
                              left: `${((startCol - 1) / daysInMonth) * 100}%`,
                              width: `${((endCol - startCol + 1) / daysInMonth) * 100}%`,
                              zIndex: 10,
                              display: 'flex',
                              alignItems: 'center',
                              padding: '0 6px',
                              fontSize: '9px',
                              textTransform: 'uppercase',
                              fontWeight: 'bold',
                              borderRadius: '4px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              ...customStyle
                            }}
                            title={`${leave.leave_type.replace('_', ' ')}: ${new Date(leave.from_date).toLocaleDateString('en-GB')} - ${new Date(leave.to_date).toLocaleDateString('en-GB')} (${leave.days} days)`}
                          >
                            <span className="truncate">{leave.leave_type.substring(0, 3)} ({leave.days}d)</span>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
