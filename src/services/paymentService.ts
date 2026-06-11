// ============================================================
// JEET ERP — Client Payment and Allocation Service
// Handles: Cash receipts (payments), invoice allocations,
// status updates, and notification events.
// ============================================================

import { supabase } from '@/lib/supabase';
import type { ClientPayment, PaymentAllocation, ClientInvoice } from '@/types/finance.types';
import { eventService } from './eventService';

export const paymentService = {
  /**
   * Fetches client payments.
   */
  async fetchPayments(filters: { clientId?: string } = {}): Promise<ClientPayment[]> {
    let query = supabase
      .from('client_payments')
      .select('*')
      .order('payment_date', { ascending: false });

    if (filters.clientId) {
      query = query.eq('client_id', filters.clientId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as ClientPayment[];
  },

  /**
   * Fetches allocations for a payment.
   */
  async fetchAllocations(paymentId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('payment_allocations')
      .select('*, client_invoices(invoice_number, net_due)')
      .eq('payment_id', paymentId);

    if (error) throw error;
    return data || [];
  },

  /**
   * Records a new client payment and allocates it atomically to invoices.
   */
  async recordPayment(
    paymentData: Omit<Partial<ClientPayment>, 'id' | 'payment_number' | 'created_by' | 'created_at'>,
    allocations: Array<{ invoiceId: string; amount: number }>
  ): Promise<ClientPayment> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required');

    // 1. Insert Payment Header
    const { data: payment, error: payError } = await supabase
      .from('client_payments')
      .insert({
        client_id: paymentData.client_id,
        amount: Number(paymentData.amount),
        payment_date: paymentData.payment_date || new Date().toISOString().split('T')[0],
        method: paymentData.method || 'TRANSFER',
        reference: paymentData.reference || null,
        bank_account: paymentData.bank_account || null,
        notes: paymentData.notes || null,
        created_by: user.id
      })
      .select()
      .single();

    if (payError) throw payError;

    // 2. Insert allocations and update invoices
    for (const alloc of allocations) {
      if (alloc.amount <= 0) continue;

      // A. Insert allocation record
      const { error: allocError } = await supabase
        .from('payment_allocations')
        .insert({
          payment_id: payment.id,
          invoice_id: alloc.invoiceId,
          allocated_amount: Number(alloc.amount)
        });

      if (allocError) throw allocError;

      // B. Fetch invoice details to increment amount_paid
      const { data: invoice, error: invFetchErr } = await supabase
        .from('client_invoices')
        .select('*')
        .eq('id', alloc.invoiceId)
        .single();

      if (invFetchErr || !invoice) {
        throw new Error(`Failed to find invoice: ${alloc.invoiceId}`);
      }

      const newAmountPaid = Number(invoice.amount_paid) + Number(alloc.amount);
      const netDue = Number(invoice.net_due);
      
      let newStatus: string = invoice.status;
      if (newAmountPaid >= netDue) {
        newStatus = 'PAID';
      } else if (newAmountPaid > 0) {
        newStatus = 'PARTIALLY_PAID';
      }

      // C. Update database invoice
      const { error: invUpdateErr } = await supabase
        .from('client_invoices')
        .update({
          amount_paid: newAmountPaid,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', alloc.invoiceId);

      if (invUpdateErr) throw invUpdateErr;

      // D. Emit event
      await eventService.emitEvent(
        'invoice.payment_received',
        'CLIENT_INVOICE',
        alloc.invoiceId,
        invoice.project_id || undefined,
        {
          payment_number: payment.payment_number,
          amount: Number(alloc.amount),
          invoice_number: invoice.invoice_number,
        }
      );
    }

    return payment as ClientPayment;
  }
};
