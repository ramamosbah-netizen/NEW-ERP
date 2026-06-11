// ============================================================
// JEET ERP — Accounting Journal Export Service (AP/AR Ledger)
// Formats: Excel (using SheetJS) & CSV formats for ERP syncing
// ============================================================

import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import type { JournalLine } from '@/types/vat.types';
import { round2 } from './invoiceMathService';

export const accountingExportService = {
  /**
   * Computes the detailed double-entry journal ledger lines for a date range.
   */
  async generateJournalLines(startDate: string, endDate: string): Promise<JournalLine[]> {
    const lines: JournalLine[] = [];

    // 1. Fetch Client Invoices (AR)
    const { data: clientInvoices } = await supabase
      .from('client_invoices')
      .select('*, projects(project_number)')
      .gte('invoice_date', startDate)
      .lte('invoice_date', endDate)
      .in('status', ['APPROVED', 'SENT', 'PARTIALLY_PAID', 'PAID']);

    for (const inv of clientInvoices || []) {
      const date = inv.invoice_date;
      const ref = inv.invoice_number;
      const projRef = inv.projects?.project_number || 'STANDALONE';
      const client = inv.client_name;

      // Line A: Debit Accounts Receivable (Gross Total including VAT)
      lines.push({
        date,
        reference: ref,
        description: `Tax Invoice - ${client} - Billed amount`,
        account_code: '12000',
        account_name: 'Accounts Receivable',
        debit: Number(inv.total_incl_vat),
        credit: 0,
        project_code: projRef,
        partner_name: client
      });

      // Line B: Credit Revenue (Taxable amount)
      lines.push({
        date,
        reference: ref,
        description: `Tax Invoice - ${client} - Billed revenue`,
        account_code: '40000',
        account_name: 'Sales Revenue',
        debit: 0,
        credit: Number(inv.taxable_amount),
        project_code: projRef,
        partner_name: client
      });

      // Line C: Credit VAT Output (VAT amount)
      if (Number(inv.vat_amount) > 0) {
        lines.push({
          date,
          reference: ref,
          description: `Tax Invoice - ${client} - VAT Output (5%)`,
          account_code: '22000',
          account_name: 'VAT Output Liability',
          debit: 0,
          credit: Number(inv.vat_amount),
          project_code: projRef,
          partner_name: client
        });
      }

      // Line D: Advance Recovery (Credit AR, Debit Deferred Revenue)
      if (Number(inv.advance_recovery) > 0) {
        lines.push({
          date,
          reference: ref,
          description: `Tax Invoice - ${client} - Advance Recovery deduction`,
          account_code: '23000',
          account_name: 'Deferred Revenue (Advance)',
          debit: Number(inv.advance_recovery),
          credit: 0,
          project_code: projRef,
          partner_name: client
        });
        // Offsetting Credit on Accounts Receivable (reducing gross due)
        lines.push({
          date,
          reference: ref,
          description: `Tax Invoice - ${client} - Advance Recovery credit offset`,
          account_code: '12000',
          account_name: 'Accounts Receivable',
          debit: 0,
          credit: Number(inv.advance_recovery),
          project_code: projRef,
          partner_name: client
        });
      }

      // Line E: Retention Held (Debit Retention Receivable, Credit AR offset)
      if (Number(inv.retention_held) > 0) {
        lines.push({
          date,
          reference: ref,
          description: `Tax Invoice - ${client} - Retention Held receivable`,
          account_code: '12100',
          account_name: 'Retention Receivable',
          debit: Number(inv.retention_held),
          credit: 0,
          project_code: projRef,
          partner_name: client
        });
        // Offsetting Credit on Accounts Receivable
        lines.push({
          date,
          reference: ref,
          description: `Tax Invoice - ${client} - Retention Held credit offset`,
          account_code: '12000',
          account_name: 'Accounts Receivable',
          debit: 0,
          credit: Number(inv.retention_held),
          project_code: projRef,
          partner_name: client
        });
      }
    }

    // 2. Fetch Client Payments (Receipts)
    const { data: clientPayments } = await supabase
      .from('client_payments')
      .select('*, clients(name)')
      .gte('payment_date', startDate)
      .lte('payment_date', endDate);

    for (const p of clientPayments || []) {
      const date = p.payment_date;
      const ref = p.payment_number;
      const partner = p.clients?.name || 'Unknown Client';
      const bankAcct = p.bank_account || '10100';

      // Debit Bank / Cash
      lines.push({
        date,
        reference: ref,
        description: `Receipt from ${partner} - Ref ${p.reference || ''}`,
        account_code: bankAcct,
        account_name: 'Cash / Bank Account',
        debit: Number(p.amount),
        credit: 0,
        project_code: null,
        partner_name: partner
      });

      // Credit Accounts Receivable
      lines.push({
        date,
        reference: ref,
        description: `Receipt allocation - ${partner}`,
        account_code: '12000',
        account_name: 'Accounts Receivable',
        debit: 0,
        credit: Number(p.amount),
        project_code: null,
        partner_name: partner
      });
    }

    // 3. Fetch Supplier Invoices (AP)
    const { data: supplierInvoices } = await supabase
      .from('supplier_invoices')
      .select('*, pricing_suppliers(name), projects(project_number)')
      .gte('invoice_date', startDate)
      .lte('invoice_date', endDate)
      .in('status', ['APPROVED', 'SCHEDULED', 'PARTIALLY_PAID', 'PAID']);

    for (const sinv of supplierInvoices || []) {
      const date = sinv.invoice_date;
      const ref = sinv.supplier_invoice_number;
      const partner = sinv.pricing_suppliers?.name || 'Supplier';
      const projRef = sinv.projects?.project_number || 'OVERHEAD';

      // Line A: Debit Cost of Goods Sold or Administrative Expense (Taxable amount)
      lines.push({
        date,
        reference: ref,
        description: `Supplier Invoice - ${partner} - Expense purchase`,
        account_code: sinv.invoice_type === 'DIRECT_EXPENSE' ? '51000' : '50000',
        account_name: sinv.invoice_type === 'DIRECT_EXPENSE' ? 'Administrative Expense' : 'Project Cost (COGS)',
        debit: Number(sinv.taxable_amount),
        credit: 0,
        project_code: projRef,
        partner_name: partner
      });

      // Line B: Debit VAT Input (VAT amount)
      if (Number(sinv.vat_amount) > 0) {
        lines.push({
          date,
          reference: ref,
          description: `Supplier Invoice - ${partner} - VAT Input (5%)`,
          account_code: '13000',
          account_name: 'VAT Input Asset',
          debit: Number(sinv.vat_amount),
          credit: 0,
          project_code: projRef,
          partner_name: partner
        });
      }

      // Line C: Credit Accounts Payable (Total amount including VAT)
      lines.push({
        date,
        reference: ref,
        description: `Supplier Invoice - ${partner} - Payable outstanding`,
        account_code: '20000',
        account_name: 'Accounts Payable',
        debit: 0,
        credit: Number(sinv.total),
        project_code: projRef,
        partner_name: partner
      });
    }

    // 4. Fetch Supplier Payments (Disbursements)
    const { data: supplierPayments } = await supabase
      .from('supplier_payments')
      .select('*, pricing_suppliers(name)')
      .gte('payment_date', startDate)
      .lte('payment_date', endDate);

    for (const sp of supplierPayments || []) {
      const date = sp.payment_date;
      const ref = sp.payment_number;
      const partner = sp.pricing_suppliers?.name || 'Supplier';
      const bankAcct = sp.bank_account || '10100';

      // Debit Accounts Payable
      lines.push({
        date,
        reference: ref,
        description: `Payment to ${partner} - Ref ${sp.reference || ''}`,
        account_code: '20000',
        account_name: 'Accounts Payable',
        debit: Number(sp.amount),
        credit: 0,
        project_code: null,
        partner_name: partner
      });

      // Credit Bank / Cash
      lines.push({
        date,
        reference: ref,
        description: `Payment settlement - ${partner}`,
        account_code: bankAcct,
        account_name: 'Cash / Bank Account',
        debit: 0,
        credit: Number(sp.amount),
        project_code: null,
        partner_name: partner
      });
    }

    return lines;
  },

  /**
   * Generates a CSV string representation of the journal ledger.
   */
  async exportToCSV(startDate: string, endDate: string): Promise<string> {
    const lines = await this.generateJournalLines(startDate, endDate);
    
    const headers = ['Date', 'Reference', 'Description', 'Account Code', 'Account Name', 'Debit (AED)', 'Credit (AED)', 'Project Code', 'Partner Name'];
    const rows = lines.map(line => [
      line.date,
      line.reference,
      `"${line.description.replace(/"/g, '""')}"`,
      line.account_code,
      `"${line.account_name.replace(/"/g, '""')}"`,
      line.debit.toFixed(2),
      line.credit.toFixed(2),
      line.project_code || '',
      line.partner_name ? `"${line.partner_name.replace(/"/g, '""')}"` : ''
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  },

  /**
   * Triggers client-side download of a formatted Excel spreadsheet containing the journal ledger.
   */
  async exportToExcel(startDate: string, endDate: string, filename: string = 'JEET_ERP_Accounting_Journal.xlsx'): Promise<void> {
    const lines = await this.generateJournalLines(startDate, endDate);

    const data = lines.map((line, idx) => ({
      'Line No': idx + 1,
      'Posting Date': line.date,
      'Reference Doc': line.reference,
      'Description / Narration': line.description,
      'GL Account Code': line.account_code,
      'GL Account Name': line.account_name,
      'Debit (AED)': line.debit,
      'Credit (AED)': line.credit,
      'Project Code': line.project_code || '—',
      'Partner / Entity': line.partner_name || '—'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Journal Entries');

    // Column sizing
    ws['!cols'] = [
      { wch: 8 },  // Line No
      { wch: 14 }, // Date
      { wch: 18 }, // Reference
      { wch: 35 }, // Description
      { wch: 16 }, // Account Code
      { wch: 25 }, // Account Name
      { wch: 15 }, // Debit
      { wch: 15 }, // Credit
      { wch: 15 }, // Project Code
      { wch: 25 }  // Partner Name
    ];

    XLSX.writeFile(wb, filename);
  }
};
export default accountingExportService;
