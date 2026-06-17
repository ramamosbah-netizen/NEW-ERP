// ============================================================
// JEET ERP — Business Time Utility Service
// Computes business-hours deadlines in Asia/Dubai (GST = UTC+4)
// Sunday–Thursday: 08:00 – 18:00 (10 hours/day). Fridays & Saturdays off.
// ============================================================

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

// Offset in milliseconds for GST (UTC+4)
const GST_OFFSET = 4 * 60 * 60 * 1000;

export interface GSTDateTime {
  year: number;
  month: number; // 0-11
  date: number;  // 1-31
  hours: number; // 0-23
  minutes: number; // 0-59
  dayOfWeek: number; // 0 (Sun) - 6 (Sat)
}

/**
 * Helper to convert a Date into GST parts.
 */
export function getGSTParts(d: Date): GSTDateTime {
  const gstTime = new Date(d.getTime() + GST_OFFSET);
  return {
    year: gstTime.getUTCFullYear(),
    month: gstTime.getUTCMonth(),
    date: gstTime.getUTCDate(),
    hours: gstTime.getUTCHours(),
    minutes: gstTime.getUTCMinutes(),
    dayOfWeek: gstTime.getUTCDay()
  };
}

/**
 * Helper to convert GST parts back to a standard Date object.
 */
export function fromGSTParts(parts: Omit<GSTDateTime, 'dayOfWeek'>): Date {
  const utcTime = Date.UTC(parts.year, parts.month, parts.date, parts.hours, parts.minutes);
  return new Date(utcTime - GST_OFFSET);
}

/**
 * Checks if a specific date string (YYYY-MM-DD) is a weekend or holiday.
 */
export function isWeekendOrHoliday(d: Date, holidays: string[] = []): boolean {
  const parts = getGSTParts(d);
  
  // Friday (5) or Saturday (6)
  if (parts.dayOfWeek === 5 || parts.dayOfWeek === 6) {
    return true;
  }

  // Format date as YYYY-MM-DD in GST timezone
  const monthStr = String(parts.month + 1).padStart(2, '0');
  const dateStr = String(parts.date).padStart(2, '0');
  const formattedDate = `${parts.year}-${monthStr}-${dateStr}`;

  return holidays.includes(formattedDate);
}

/**
 * Moves a Date to the start of the next business day (08:00 Asia/Dubai).
 */
export function moveToNextBusinessDayStart(d: Date, holidays: string[] = []): Date {
  let temp = new Date(d.getTime());
  
  // Move to tomorrow at 08:00 GST
  while (true) {
    const parts = getGSTParts(temp);
    const tomorrowParts = {
      year: parts.year,
      month: parts.month,
      date: parts.date + 1,
      hours: 8,
      minutes: 0
    };
    temp = fromGSTParts(tomorrowParts);
    
    if (!isWeekendOrHoliday(temp, holidays)) {
      break;
    }
  }
  return temp;
}

/**
 * Adds business hours to a starting date, respecting Asia/Dubai work hours.
 */
export function addBusinessHours(start: Date, hoursToAdd: number, holidays: string[] = []): Date {
  if (hoursToAdd <= 0) return start;
  
  let current = new Date(start.getTime());

  // 1. If start time is on weekend or holiday, shift to next business day start
  if (isWeekendOrHoliday(current, holidays)) {
    // Move to 08:00 of next business day
    const parts = getGSTParts(current);
    current = fromGSTParts({
      year: parts.year,
      month: parts.month,
      date: parts.date,
      hours: 8,
      minutes: 0
    });
    // Check if that day is weekend/holiday
    if (isWeekendOrHoliday(current, holidays)) {
      current = moveToNextBusinessDayStart(current, holidays);
    }
  } else {
    // It's a business day. Check working hour boundaries
    const parts = getGSTParts(current);
    if (parts.hours < 8) {
      // Before 08:00 GST -> jump to 08:00 GST today
      current = fromGSTParts({ ...parts, hours: 8, minutes: 0 });
    } else if (parts.hours >= 18) {
      // After 18:00 GST -> jump to next business day 08:00 GST
      current = moveToNextBusinessDayStart(current, holidays);
    }
  }

  let remainingHours = hoursToAdd;

  while (remainingHours > 0) {
    const parts = getGSTParts(current);
    
    // Calculate fractional hours left in today's business day (current to 18:00 GST)
    const hoursLeftToday = 18 - (parts.hours + parts.minutes / 60);

    if (remainingHours <= hoursLeftToday) {
      // Fits in today! Just add the remaining time.
      const addMinutes = Math.round(remainingHours * 60);
      current = new Date(current.getTime() + addMinutes * 60 * 1000);
      remainingHours = 0;
    } else {
      // Doesn't fit in today. Consume the rest of today, then jump to next business day.
      remainingHours -= hoursLeftToday;
      current = moveToNextBusinessDayStart(current, holidays);
    }
  }

  return current;
}

/**
 * Fetch company holidays as date strings (YYYY-MM-DD) from Supabase.
 */
export async function fetchCompanyHolidays(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('company_holidays')
      .select('holiday_date')
      .eq('is_active', true);

    if (error) {
      if (error.code === 'PGRST116' || error.code === '42P01') {
        // Table doesn't exist yet, return empty list
        return [];
      }
      throw error;
    }

    return (data || []).map(h => h.holiday_date);
  } catch (err) {
    logger.error('Failed to fetch company holidays:', err);
    return [];
  }
}
