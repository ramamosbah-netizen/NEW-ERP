// ============================================================
// JEET ERP — Currency Number to Words Engine
// Converts numbers to uppercase English words for AED
// ============================================================

export function amountToWords(amount: number, currency: string = 'AED'): string {
  if (amount === null || isNaN(amount)) return '';
  if (amount === 0) return 'ZERO DIRHAMS ONLY';

  // Round to 2 decimal places to avoid float rounding errors
  const roundedAmount = Math.round(amount * 100) / 100;
  const dirhamsVal = Math.floor(roundedAmount);
  const filsVal = Math.round((roundedAmount - dirhamsVal) * 100);

  const ONES = [
    '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
    'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'
  ];

  const TENS = [
    '', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'
  ];

  const SCALES = ['', 'THOUSAND', 'MILLION', 'BILLION', 'TRILLION'];

  const convertThreeDigits = (num: number): string => {
    let result = '';
    const hundreds = Math.floor(num / 100);
    const remainder = num % 100;

    if (hundreds > 0) {
      result += ONES[hundreds] + ' HUNDRED';
      if (remainder > 0) {
        result += ' AND ';
      }
    }

    if (remainder > 0) {
      if (remainder < 20) {
        result += ONES[remainder];
      } else {
        const tens = Math.floor(remainder / 10);
        const ones = remainder % 10;
        result += TENS[tens];
        if (ones > 0) {
          result += '-' + ONES[ones];
        }
      }
    }

    return result;
  };

  const convertLargeNumber = (num: number): string => {
    if (num === 0) return '';
    
    let words = '';
    let scaleIndex = 0;
    let temp = num;

    while (temp > 0) {
      const chunk = temp % 1000;
      if (chunk > 0) {
        const chunkWords = convertThreeDigits(chunk);
        const scale = SCALES[scaleIndex];
        words = chunkWords + (scale ? ' ' + scale : '') + (words ? ' ' + words : '');
      }
      temp = Math.floor(temp / 1000);
      scaleIndex++;
    }

    return words.trim();
  };

  const dirhamsWord = convertLargeNumber(dirhamsVal);
  const mainUnit = currency === 'AED' ? 'DIRHAMS' : 'DIRHAMS';
  const subUnit = currency === 'AED' ? 'FILS' : 'FILS';

  let finalWords = dirhamsWord ? `${dirhamsWord} ${mainUnit}` : `ZERO ${mainUnit}`;

  if (filsVal > 0) {
    const filsWord = convertLargeNumber(filsVal);
    finalWords += ` AND ${filsWord} ${subUnit}`;
  }

  return finalWords.toUpperCase() + ' ONLY';
}
