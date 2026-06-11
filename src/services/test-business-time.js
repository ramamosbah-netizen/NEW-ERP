// ============================================================
// JEET ERP — Business Time Unit Test Script
// Assertions verifying business hours calculations.
// Run: node src/services/test-business-time.js
// ============================================================

const GST_OFFSET = 4 * 60 * 60 * 1000;

function getGSTParts(d) {
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

function fromGSTParts(parts) {
  const utcTime = Date.UTC(parts.year, parts.month, parts.date, parts.hours, parts.minutes);
  return new Date(utcTime - GST_OFFSET);
}

function isWeekendOrHoliday(d, holidays = []) {
  const parts = getGSTParts(d);
  if (parts.dayOfWeek === 5 || parts.dayOfWeek === 6) return true;
  const monthStr = String(parts.month + 1).padStart(2, '0');
  const dateStr = String(parts.date).padStart(2, '0');
  const formattedDate = `${parts.year}-${monthStr}-${dateStr}`;
  return holidays.includes(formattedDate);
}

function moveToNextBusinessDayStart(d, holidays = []) {
  let temp = new Date(d.getTime());
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

function addBusinessHours(start, hoursToAdd, holidays = []) {
  if (hoursToAdd <= 0) return start;
  let current = new Date(start.getTime());

  if (isWeekendOrHoliday(current, holidays)) {
    const parts = getGSTParts(current);
    current = fromGSTParts({
      year: parts.year,
      month: parts.month,
      date: parts.date,
      hours: 8,
      minutes: 0
    });
    if (isWeekendOrHoliday(current, holidays)) {
      current = moveToNextBusinessDayStart(current, holidays);
    }
  } else {
    const parts = getGSTParts(current);
    if (parts.hours < 8) {
      current = fromGSTParts({ ...parts, hours: 8, minutes: 0 });
    } else if (parts.hours >= 18) {
      current = moveToNextBusinessDayStart(current, holidays);
    }
  }

  let remainingHours = hoursToAdd;
  while (remainingHours > 0) {
    const parts = getGSTParts(current);
    const hoursLeftToday = 18 - (parts.hours + parts.minutes / 60);

    if (remainingHours <= hoursLeftToday) {
      const addMinutes = Math.round(remainingHours * 60);
      current = new Date(current.getTime() + addMinutes * 60 * 1000);
      remainingHours = 0;
    } else {
      remainingHours -= hoursLeftToday;
      current = moveToNextBusinessDayStart(current, holidays);
    }
  }

  return current;
}

// ============================================================
// TEST SUITE
// ============================================================

const holidays = ['2026-06-14']; // A Sunday holiday

function runTests() {
  console.log('Running Business Time Unit Tests...');
  let failures = 0;

  function assert(name, condition) {
    if (!condition) {
      console.error(`❌ FAIL: ${name}`);
      failures++;
    } else {
      console.log(`✅ PASS: ${name}`);
    }
  }

  // Test Case 1: Simple addition within the same business day
  // Start: Sunday 09:00 GST -> Add 4 hours -> Should be Sunday 13:00 GST
  const start1 = fromGSTParts({ year: 2026, month: 5, date: 7, hours: 9, minutes: 0 }); // 7th June 2026 is Sunday
  const result1 = addBusinessHours(start1, 4);
  const parts1 = getGSTParts(result1);
  assert('Same day addition', parts1.hours === 13 && parts1.date === 7);

  // Test Case 2: Crossing over one night
  // Start: Sunday 15:00 GST -> Add 5 hours -> Should be Monday 10:00 GST (3h today + 2h tomorrow)
  const start2 = fromGSTParts({ year: 2026, month: 5, date: 7, hours: 15, minutes: 0 });
  const result2 = addBusinessHours(start2, 5);
  const parts2 = getGSTParts(result2);
  assert('Crossing one night', parts2.hours === 10 && parts2.date === 8 && parts2.dayOfWeek === 1);

  // Test Case 3: Crossing the weekend (Friday + Saturday)
  // Start: Thursday 16:00 GST -> Add 4 hours -> Should be Sunday 10:00 GST (2h Thursday + 2h Sunday)
  const start3 = fromGSTParts({ year: 2026, month: 5, date: 11, hours: 16, minutes: 0 }); // 11th June is Thursday
  const result3 = addBusinessHours(start3, 4);
  const parts3 = getGSTParts(result3);
  assert('Crossing weekend (Thur->Sun)', parts3.hours === 10 && parts3.date === 14 && parts3.dayOfWeek === 0);

  // Test Case 4: Respecting custom holidays
  // Start: Thursday 16:00 GST -> Add 4 hours, but Sunday 14th June is a Holiday!
  // Should bypass Sunday and end on Monday 15th June 10:00 GST
  const result4 = addBusinessHours(start3, 4, holidays);
  const parts4 = getGSTParts(result4);
  assert('Respecting custom holiday (Thur->Mon)', parts4.hours === 10 && parts4.date === 15 && parts4.dayOfWeek === 1);

  // Test Case 5: Starting on a weekend
  // Start: Friday 10:00 GST -> Add 2 hours -> Should shift to Sunday 10:00 GST
  const start5 = fromGSTParts({ year: 2026, month: 5, date: 12, hours: 10, minutes: 0 }); // 12th June is Friday
  const result5 = addBusinessHours(start5, 2);
  const parts5 = getGSTParts(result5);
  assert('Starting on weekend (Fri->Sun)', parts5.hours === 10 && parts5.date === 14 && parts5.dayOfWeek === 0);

  // Test Case 6: Starting after hours
  // Start: Sunday 19:30 GST -> Add 1 hour -> Should end on Monday 09:00 GST
  const start6 = fromGSTParts({ year: 2026, month: 5, date: 7, hours: 19, minutes: 30 });
  const result6 = addBusinessHours(start6, 1);
  const parts6 = getGSTParts(result6);
  assert('Starting after hours (Sun->Mon)', parts6.hours === 9 && parts6.date === 8 && parts6.dayOfWeek === 1);

  if (failures === 0) {
    console.log('🎉 All unit tests completed successfully!');
  } else {
    console.error(`💥 Failed ${failures} tests.`);
    process.exit(1);
  }
}

runTests();
