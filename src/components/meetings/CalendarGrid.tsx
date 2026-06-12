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
      <div className="flex items-center justify-between pb-4 border-b border-border-color mb-5">
        <h3 className="quote-card-title flex items-center gap-2">
          <CalIcon size={16} className="text-primary" />
          {monthNames[month]} {year}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded bg-bg-dark border border-border-color text-text-secondary hover:text-primary hover:border-primary/20 transition-all cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-2.5 py-1 rounded bg-bg-dark border border-border-color text-[10px] font-bold font-mono text-text-secondary hover:text-primary hover:border-primary/20 transition-all uppercase tracking-wider cursor-pointer"
          >
            Today
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded bg-bg-dark border border-border-color text-text-secondary hover:text-primary hover:border-primary/20 transition-all cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Weekdays indicator */}
      <div className="grid grid-cols-7 text-center font-mono text-[10px] font-extrabold text-text-muted uppercase tracking-widest pb-2.5 border-b border-border-color">
        {weekdays.map(d => (
          <div key={d} className={d === 'Fri' || d === 'Sat' ? 'text-text-muted' : 'text-text-secondary'}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 grid-rows-5 gap-1.5 mt-2.5">
        {daysArray.map((day, idx) => {
          if (day === null) {
            return (
              <div
                key={`empty-${idx}`}
                className="min-h-[95px] rounded-lg bg-bg-dark/10 border border-transparent"
              />
            );
          }

          const { meetings: dayMeetings, tasks: dayTasks } = getEventsForDay(day);
          const isToday = isSameDate(new Date(), new Date(year, month, day));

          return (
            <div
              key={`day-${day}`}
              className={`min-h-[105px] p-2 rounded-lg border flex flex-col justify-between transition-all bg-bg-dark/35 hover:bg-bg-card-hover/20 ${
                isToday
                  ? 'border-primary/45 bg-primary/5 shadow-[inset_0_0_12px_var(--primary-glow)]'
                  : 'border-border-color hover:border-border-color'
              }`}
            >
              {/* Day Number */}
              <div className="flex justify-between items-center">
                <span className={`text-[11px] font-mono font-bold ${
                  isToday ? 'text-primary font-extrabold' : 'text-text-muted'
                }`}>
                  {String(day).padStart(2, '0')}
                </span>
                {(dayMeetings.length > 0 || dayTasks.length > 0) && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_4px_var(--primary)]" />
                )}
              </div>

              {/* Items display */}
              <div className="mt-1 flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-0.5 max-h-[72px]">
                {/* Meetings */}
                {dayMeetings.map(m => (
                  <div
                    key={m.id}
                    onClick={() => onSelectMeeting(m)}
                    className="p-1 rounded bg-secondary-glow/20 border border-secondary/35 text-secondary text-[9px] truncate cursor-pointer hover:border-secondary/50 flex items-center gap-1 font-sans"
                    title={`Meeting: ${m.title}`}
                  >
                    <Users size={8} className="flex-shrink-0" />
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
                      className={`p-1 rounded bg-bg-dark/40 border border-border-color text-[9px] truncate cursor-pointer flex items-center gap-1 font-sans ${
                        isDone
                          ? 'border-border-color/10 text-text-muted line-through'
                          : 'text-text-secondary hover:border-primary/20'
                      }`}
                      title={`Task: ${t.title}`}
                    >
                      <CheckSquare size={8} className="flex-shrink-0 text-text-muted" />
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
