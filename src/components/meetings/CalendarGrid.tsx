// ============================================================
// JEET ERP — Calendar & Event Grid Component
// ============================================================

'use client';

import React, { useState } from 'react';
import type { Meeting } from '@/types/meeting.types';
import type { Task } from '@/types/task.types';
import { ChevronLeft, ChevronRight, Calendar as CalIcon, Users, CheckSquare } from 'lucide-react';

type Props = {
  meetings: Meeting[];
  tasks: Task[];
  onSelectMeeting: (m: Meeting) => void;
  onSelectTask: (t: Task) => void;
};

export const CalendarGrid: React.FC<Props> = ({ meetings, tasks, onSelectMeeting, onSelectTask }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Calendar math
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday, 6 is Saturday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Create grid arrays
  const daysArray: (number | null)[] = [];
  
  // Fill initial blanks (previous month days or empty)
  for (let i = 0; i < firstDayOfMonth; i++) {
    daysArray.push(null);
  }
  
  // Fill active month days
  for (let i = 1; i <= daysInMonth; i++) {
    daysArray.push(i);
  }

  // Helper to match dates
  const isSameDate = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  const getEventsForDay = (day: number) => {
    const dayDate = new Date(year, month, day);
    
    const dayMeetings = meetings.filter(m => isSameDate(new Date(m.starts_at), dayDate));
    const dayTasks = tasks.filter(t => t.due_date && isSameDate(new Date(t.due_date), dayDate));

    return { meetings: dayMeetings, tasks: dayTasks };
  };

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="quote-card overflow-hidden">
      {/* Control Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--border-color)] mb-5">
        <h3 className="quote-card-title flex items-center gap-2 text-[var(--text-primary)]">
          <CalIcon size={16} className="text-[var(--accent)]" />
          {monthNames[month]} {year}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-all cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-2.5 py-1 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[10px] font-bold font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-all uppercase tracking-wider cursor-pointer"
          >
            Today
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-all cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Weekdays indicator */}
      <div className="grid grid-cols-7 text-center font-mono text-[10px] font-extrabold uppercase tracking-widest pb-2.5 border-b border-[var(--border-color)]">
        {weekdays.map(d => (
          <div key={d} className={d === 'Fri' || d === 'Sat' ? 'text-[var(--text-secondary)] opacity-85' : 'text-[var(--text-primary)]'}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1.5 mt-2.5">
        {daysArray.map((day, idx) => {
          if (day === null) {
            return (
              <div
                key={`empty-${idx}`}
                className="min-h-[105px] rounded-lg bg-[var(--bg-card-hover)]/40 border border-transparent opacity-45"
              />
            );
          }

          const { meetings: dayMeetings, tasks: dayTasks } = getEventsForDay(day);
          const isToday = isSameDate(new Date(), new Date(year, month, day));

          return (
            <div
              key={`day-${day}`}
              className={`min-h-[105px] p-2 rounded-lg border flex flex-col justify-between transition-all bg-[var(--bg-card-hover)] ${
                isToday
                  ? 'border-[var(--accent)] bg-[var(--accent-glow)]'
                  : 'border-[var(--border-color)] hover:border-[var(--text-secondary)]'
              }`}
            >
              {/* Day Number */}
              <div className="flex justify-between items-center">
                {isToday ? (
                  <span className="flex items-center justify-center h-5 w-5 rounded-full bg-[var(--accent)] text-[var(--bg-card)] text-[10px] font-mono font-bold">
                    {day}
                  </span>
                ) : (
                  <span className="text-[11px] font-mono font-bold text-[var(--text-primary)]">
                    {String(day).padStart(2, '0')}
                  </span>
                )}
                {(dayMeetings.length > 0 || dayTasks.length > 0) && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                )}
              </div>

              {/* Items display */}
              <div className="mt-1 flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-0.5 max-h-[72px]">
                {/* Meetings */}
                {dayMeetings.map(m => (
                  <div
                    key={m.id}
                    onClick={() => onSelectMeeting(m)}
                    className="p-1 rounded bg-[var(--accent-glow)]/50 border border-[var(--accent)]/30 border-l-2 border-l-[var(--accent)] text-[var(--text-primary)] text-[11px] font-bold truncate cursor-pointer hover:border-[var(--accent)] flex items-center gap-1 font-sans transition-all"
                    title={`Meeting: ${m.title}`}
                  >
                    <Users size={8} className="flex-shrink-0 text-[var(--accent)]" />
                    <span className="truncate">{m.title}</span>
                  </div>
                ))}

                {/* Tasks */}
                {dayTasks.map(t => {
                   const isDone = ['DONE', 'DONE_AUTO'].includes(t.status);
                   return (
                     <div
                       key={t.id}
                       onClick={() => onSelectTask(t)}
                       className={`p-1 rounded border border-l-2 text-[11px] font-bold truncate cursor-pointer flex items-center gap-1 font-sans transition-all ${
                         isDone
                           ? 'bg-[var(--bg-card)] border-[var(--border-color)] border-l-2 border-l-[var(--text-muted)]/50 text-[var(--text-secondary)] line-through opacity-75 hover:border-[var(--text-secondary)]'
                           : 'bg-[var(--success-glow)]/50 border border-[var(--success)]/30 border-l-[var(--success)] text-[var(--text-primary)] hover:border-[var(--success)]'
                       }`}
                       title={`Task: ${t.title}`}
                     >
                       <CheckSquare size={8} className={`flex-shrink-0 ${isDone ? 'text-[var(--text-secondary)]' : 'text-[var(--success)]'}`} />
                       <span className="truncate">{t.title}</span>
                     </div>
                   );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarGrid;
