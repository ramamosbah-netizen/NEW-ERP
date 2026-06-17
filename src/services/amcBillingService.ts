// ============================================================
// JEET ERP — AMC Billing Schedule Service
// Manages installment calculations and automated draft invoicing.
// ============================================================

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { invoiceService } from './invoiceService';
import { eventService } from './eventService';
import type { AMCContract, AMCBillingSchedule } from '@/types/amc.types';

/**
 * Helper to add calendar months to a date string (YYYY-MM-DD).
 * Handles end-of-month adjustments (e.g., Jan 31 + 1 month -> Feb 28/29).
 */
export function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  const expectedDay = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== expectedDay) {
    d.setDate(0); // adjust to last day of previous month
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const amcBillingService = {
  /**
   * Generates and inserts the billing schedule for an active contract.
   */
  async generateBillingSchedule(contract: AMCContract): Promise<AMCBillingSchedule[]> {
    const { start_date, annual_value, billing_frequency, id: contractId } = contract;
    const installments: Omit<AMCBillingSchedule, 'id' | 'created_at'>[] = [];

    let count = 1;
    let monthsStep = 0;

    switch (billing_frequency) {
      case 'ANNUAL_ADVANCE':
        count = 1;
        monthsStep = 12;
        break;
      case 'SEMI_ANNUAL':
        count = 2;
        monthsStep = 6;
        break;
      case 'QUARTERLY':
        count = 4;
        monthsStep = 3;
        break;
      case 'MONTHLY':
        count = 12;
        monthsStep = 1;
        break;
    }

    const valuePerInstallment = Number((annual_value / count).toFixed(2));

    for (let i = 0; i < count; i++) {
      const dueDate = i === 0 ? start_date : addMonths(start_date, i * monthsStep);
      installments.push({
        contract_id: contractId,
        sequence: i + 1,
        due_date: dueDate,
        amount: valuePerInstallment,
        status: 'PENDING'
      });
    }

    // Insert into DB
    const { data, error } = await supabase
      .from('amc_billing_schedule')
      .insert(installments)
      .select();

    if (error) {
      logger.error('Failed to save billing schedule:', error);
      throw error;
    }

    return (data || []) as AMCBillingSchedule[];
  },

  /**
   * Scans for pending installments due in the next 7 days and generates draft invoices.
   * Can be run via a daily cron edge function.
   */
  async processDueInstallments(): Promise<{ processedCount: number }> {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Query pending schedules due between today and 7 days from now
    const { data: dueSchedules, error: schedError } = await supabase
      .from('amc_billing_schedule')
      .select('*, amc_contracts(*)')
      .eq('status', 'PENDING')
      .gte('due_date', today)
      .lte('due_date', sevenDaysLater);

    if (schedError) {
      logger.error('Failed to query due billing schedules:', schedError);
      throw schedError;
    }

    let processedCount = 0;

    for (const schedule of (dueSchedules || [])) {
      const contract = schedule.amc_contracts as AMCContract;
      if (!contract) continue;

      try {
        logger.debug(`Generating draft invoice for contract ${contract.contract_number}, sequence ${schedule.sequence}`);

        // 1. Create client invoice draft using the invoiceService
        const invoiceData = {
          client_id: contract.client_id,
          client_name: contract.client_name,
          client_trn: contract.client_trn,
          client_address: contract.client_address,
          invoice_type: 'STANDALONE' as const,
          invoice_date: today,
          supply_date: today,
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          notes: `Installment ${schedule.sequence} of ${contract.billing_frequency} schedule for AMC Contract ${contract.contract_number}. Site: ${contract.site_name}.`
        };

        const itemData = [
          {
            description: `Annual Maintenance Contract Installment (Seq: ${schedule.sequence}) - ${contract.contract_number} (Site: ${contract.site_name})`,
            quantity: 1,
            unit: 'Nos',
            unit_price: Number(schedule.amount),
            vat_rate: 5.00
          }
        ];

        const createdInvoice = await invoiceService.createInvoiceDraft(invoiceData, itemData);

        // 2. Link invoice to the schedule item and set status to INVOICED
        const { error: updateError } = await supabase
          .from('amc_billing_schedule')
          .update({
            status: 'INVOICED',
            invoice_id: createdInvoice.id
          })
          .eq('id', schedule.id);

        if (updateError) throw updateError;

        // 3. Emit amc.billing_due event
        await eventService.emitEvent(
          'amc.billing_due',
          'AMC_CONTRACT',
          contract.id,
          contract.origin_project_id || undefined,
          {
            contract_number: contract.contract_number,
            client_name: contract.client_name,
            sequence: schedule.sequence,
            amount: schedule.amount,
            invoice_id: createdInvoice.id
          }
        );

        processedCount++;
      } catch (err) {
        logger.error(`Failed to process schedule ID ${schedule.id}:`, err);
      }
    }

    return { processedCount };
  }
};
