// ============================================================
// JEET ERP — Currency to English Words Conversion Service
// Formats: AED (Dirhams and Fils)
// Example: 1,250.50 -> One Thousand Two Hundred Fifty Dirhams and Fifty Fils Only
// ============================================================

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

const SCALES = ['', 'Thousand', 'Million', 'Billion'];

function convertLessThanThousand(num: number): string {
  let words = '';

  if (num >= 100) {
    words += ONES[Math.floor(num / 100)] + ' Hundred ';
    num %= 100;
  }

  if (num >= 20) {
    words += TENS[Math.floor(num / 10)] + ' ';
    num %= 10;
  }

  if (num > 0) {
    words += ONES[num] + ' ';
  }

  return words.trim();
}

/**
 * Converts a number of Dirhams to its English word representation.
 */
function convertIntegerToWords(num: number): string {
  if (num === 0) return 'Zero';

  let words = '';
  let scaleIndex = 0;

  while (num > 0) {
    const chunk = num % 1000;
    if (chunk > 0) {
      const chunkWords = convertLessThanThousand(chunk);
      words = chunkWords + (SCALES[scaleIndex] ? ' ' + SCALES[scaleIndex] : '') + ' ' + words;
    }
    num = Math.floor(num / 1000);
    scaleIndex++;
  }

  return words.trim();
}

/**
 * Converts a numerical AED amount to UAE Dirhams and Fils in words.
 */
export function convertAmountToWords(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '';
  }

  // Ensure positive number and round to 2 decimals
  const positiveAmount = Math.abs(amount);
  const roundedAmountString = positiveAmount.toFixed(2);
  const parts = roundedAmountString.split('.');
  
  const dirhams = parseInt(parts[0], 10);
  const fils = parseInt(parts[1], 10);

  const dirhamsWords = convertIntegerToWords(dirhams);
  const filsWords = fils > 0 ? convertIntegerToWords(fils) : '';

  let result = `${dirhamsWords} Dirham${dirhams === 1 ? '' : 's'}`;
  
  if (fils > 0) {
    result += ` and ${filsWords} Fils`;
  }
  
  result += ' Only';

  // Capitalize first letter and return
  return result.charAt(0).toUpperCase() + result.slice(1);
}
