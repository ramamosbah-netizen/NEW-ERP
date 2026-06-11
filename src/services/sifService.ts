// ============================================================
// JEET ERP — WPS SIF Generation Service
// Reference: MOHRE / UAE Central Bank Wages Protection System (WPS)
// ============================================================

import type { PayrollLine } from '@/types/payroll.types';

export const sifService = {
  /**
   * Validates UAE IBAN checksum using ISO 7064 Mod 97-10.
   * Format: AE + 21 digits (total 23 characters)
   */
  validateUAEIBAN(iban: string): boolean {
    const cleaned = iban.replace(/\s+/g, '').toUpperCase();
    
    // Check length and format
    if (cleaned.length !== 23) return false;
    if (!cleaned.startsWith('AE')) return false;
    
    const digitsOnly = cleaned.slice(2);
    if (!/^\d+$/.test(digitsOnly)) return false;
    
    // Rearrange: AE[Checksum] -> [digits] + AE + [Checksum]
    // AE corresponds to A=10, E=14 -> 1014
    const rearranged = digitsOnly.slice(2) + '1014' + digitsOnly.slice(0, 2);
    
    // String modulo 97 to prevent overflow / precision loss
    let remainder = 0;
    for (let i = 0; i < rearranged.length; i++) {
      remainder = (remainder * 10 + parseInt(rearranged[i], 10)) % 97;
    }
    
    return remainder === 1;
  },

  /**
   * Generates a Wages Protection System (WPS) SIF file string.
   * CSV, no header, EDR rows first, SCR trailer row last.
   */
  generateSIF(params: {
    establishmentId: string; // 13 digits
    bankRoutingCode: string; // 9 digits
    salaryMonth: string; // YYYY-MM-DD or MMYYYY
    lines: PayrollLine[];
    fileReference?: string;
  }): {
    content: string;
    filename: string;
    validationErrors: string[];
  } {
    const { establishmentId, bankRoutingCode, salaryMonth, lines, fileReference } = params;
    const errors: string[] = [];
    
    // Format salary month to MMYYYY and date parts
    let dateObj = new Date();
    let yyyy = dateObj.getFullYear();
    let mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    let formattedSalaryMonth = '';

    if (salaryMonth.includes('-')) {
      const parts = salaryMonth.split('-');
      formattedSalaryMonth = parts[1] + parts[0]; // MMYYYY
      yyyy = parseInt(parts[0], 10);
      mm = parts[1];
    } else {
      formattedSalaryMonth = salaryMonth; // assume MMYYYY
    }

    // Build Filename: {EstablishmentID}{YYMMDDHHMMSS}.SIF
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const filename = `${establishmentId}${yy}${m}${d}${hh}${min}${ss}.SIF`;

    // Validate Company Settings
    if (!/^\d{13}$/.test(establishmentId)) {
      errors.push(`Establishment ID must be exactly 13 digits: "${establishmentId}"`);
    }
    if (!/^\d{9}$/.test(bankRoutingCode)) {
      errors.push(`Bank routing code must be exactly 9 digits: "${bankRoutingCode}"`);
    }

    const edrRows: string[] = [];
    let totalNetPay = 0;

    // Process EDR rows
    lines.forEach((line, index) => {
      const empName = line.employee?.full_name_en || `Employee ${index + 1}`;
      
      // Person Code check
      const personCode = line.mohre_person_code || '';
      if (!/^\d{14}$/.test(personCode)) {
        errors.push(`[${empName}] MOHRE Person Code must be exactly 14 digits: "${personCode}"`);
      }
      
      // Routing code check
      const agentId = line.agent_id || '';
      if (!/^\d{9}$/.test(agentId)) {
        errors.push(`[${empName}] Routing/Agent ID must be exactly 9 digits: "${agentId}"`);
      }

      // IBAN check
      const iban = line.iban || '';
      if (!this.validateUAEIBAN(iban)) {
        errors.push(`[${empName}] Invalid UAE IBAN checksum: "${iban}"`);
      }

      // Calculation variables
      // Fixed pay = Basic + Allowances
      const fixedPay = Number(line.basic_salary) + Number(line.housing_allowance) + Number(line.transport_allowance) + Number(line.other_allowance);
      
      // Variable pay = OT + Bonuses + Adjustments (adjustments can be bonuses/deductions)
      const adjTotal = line.adjustments.reduce((sum, adj) => sum + Number(adj.amount), 0);
      const variablePay = Number(line.ot_amount) + (adjTotal > 0 ? adjTotal : 0);
      
      // Net pay check
      if (line.net_pay <= 0) {
        errors.push(`[${empName}] Net salary must be greater than zero: ${line.net_pay} AED`);
      }

      totalNetPay += Number(line.net_pay);

      // Period dates for WPS
      // SIF requires Start Date & End Date in YYYY-MM-DD
      const daysInMonth = new Date(yyyy, parseInt(mm, 10), 0).getDate();
      const payStartDate = `${yyyy}-${mm}-01`;
      const payEndDate = `${yyyy}-${mm}-${daysInMonth}`;

      // Formatted EDR row
      // EDR, Person Code, Agent ID, IBAN, Start Date, End Date, Days, Fixed Pay, Variable Pay, Leave Days
      const edr = [
        'EDR',
        personCode,
        agentId,
        iban.replace(/\s+/g, ''),
        payStartDate,
        payEndDate,
        line.days_worked,
        fixedPay.toFixed(2),
        variablePay.toFixed(2),
        line.leave_deductions > 0 ? Math.ceil(line.leave_deductions / (fixedPay / 30)) : 0 // estimate leave days
      ].join(',');

      edrRows.push(edr);
    });

    // Reference limit 15 chars
    const ref = (fileReference || `PAY${formattedSalaryMonth}`).slice(0, 15);

    // File Creation Date & Time
    const fileDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const fileTime = `${hh}${min}`;

    // SCR trailer row
    // SCR, EstablishmentID, BankRouting, FileCreationDate, FileCreationTime, SalaryMonth, EDRCount, TotalAmount, Currency, Reference
    const scr = [
      'SCR',
      establishmentId,
      bankRoutingCode,
      fileDate,
      fileTime,
      formattedSalaryMonth,
      lines.length,
      totalNetPay.toFixed(2),
      'AED',
      ref
    ].join(',');

    const content = [...edrRows, scr].join('\r\n') + '\r\n'; // SIF files are CRLF terminated

    return {
      content,
      filename,
      validationErrors: errors
    };
  }
};

export default sifService;
