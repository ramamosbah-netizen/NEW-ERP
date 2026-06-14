// ============================================================
// JEET ERP — UAE VAT Return (FTA Form 201) Service
// Computes outputs/inputs, Emirate splits, and handles locking.
// ============================================================

import { supabase } from '@/lib/supabase';
import type { VATPeriod, VATForm201 } from '@/types/vat.types';
import { round2 } from './invoiceMathService';

export const vatService = {
  /**
   * Fetches list of all VAT periods.
   */
  async fetchVATPeriods(): Promise<VATPeriod[]> {
    const { data, error } = await supabase
      .from('vat_periods')
      .select('*')
      .order('start_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Initializes a new VAT period.
   */
  async createVATPeriod(
    periodData: Omit<Partial<VATPeriod>, 'id' | 'status' | 'is_active' | 'created_by' | 'created_at' | 'updated_at'>
  ): Promise<VATPeriod> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required');

    const { data, error } = await supabase
      .from('vat_periods')
      .insert({
        name: periodData.name,
        start_date: periodData.start_date,
        end_date: periodData.end_date,
        filing_deadline: periodData.filing_deadline,
        status: 'OPEN',
        created_by: user.id
      })
      .select()
      .single();

    if (error) throw error;
    return data as VATPeriod;
  },

  /**
   * Locks a VAT period, making it immutable.
   */
  async lockVATPeriod(id: string): Promise<boolean> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required');

    const { error } = await supabase
      .from('vat_periods')
      .update({
        status: 'LOCKED',
        locked_by: user.id,
        locked_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  /**
   * Computes the complete FTA Form 201 data for a VAT period.
   */
  async computeForm201(periodId: string): Promise<VATForm201> {
    const { data: period, error: perErr } = await supabase
      .from('vat_periods')
      .select('*')
      .eq('id', periodId)
      .single();

    if (perErr) throw perErr;

    const start = period.start_date;
    const end = period.end_date;

    // 1. Fetch Client Invoices approved/sent in range (Outputs)
    const { data: clientInvoices } = await supabase
      .from('client_invoices')
      .select('*, projects(emirate), clients(city)')
      .gte('invoice_date', start)
      .lte('invoice_date', end)
      .in('status', ['APPROVED', 'SENT', 'PARTIALLY_PAID', 'PAID']);

    // Initialize Emirate buckets
    const emirateOutputs: Record<string, { taxable_amount: number; vat_amount: number }> = {
      ABU_DHABI: { taxable_amount: 0, vat_amount: 0 },
      DUBAI: { taxable_amount: 0, vat_amount: 0 },
      SHARJAH: { taxable_amount: 0, vat_amount: 0 },
      AJMAN: { taxable_amount: 0, vat_amount: 0 },
      UMM_AL_QUWAIN: { taxable_amount: 0, vat_amount: 0 },
      RAS_AL_KHAIMAH: { taxable_amount: 0, vat_amount: 0 },
      FUJAIRAH: { taxable_amount: 0, vat_amount: 0 }
    };

    let box4ZeroRated = 0;
    let box5Exempt = 0;

    for (const inv of clientInvoices || []) {
      // Determine Emirate
      let emirate = 'DUBAI'; // Default to Dubai
      if (inv.projects?.emirate) {
        emirate = inv.projects.emirate;
      } else if ((inv.clients as any)?.city) {
        const cityUpper = (inv.clients as any).city.toUpperCase().replace(/\s+/g, '_');
        const validEmirates = ['DUBAI', 'ABU_DHABI', 'SHARJAH', 'AJMAN', 'UMM_AL_QUWAIN', 'RAS_AL_KHAIMAH', 'FUJAIRAH'];
        if (validEmirates.includes(cityUpper)) {
          emirate = cityUpper;
        }
      }

      const taxable = Number(inv.taxable_amount || 0);
      const vat = Number(inv.vat_amount || 0);

      if (vat === 0 && taxable > 0) {
        // Zero-rated or exempt. In construction, exports or certain residential are zero-rated.
        // For simple split: let's classify zero-rated or exempt if VAT is zero
        box4ZeroRated += taxable;
      } else {
        if (emirateOutputs[emirate]) {
          emirateOutputs[emirate].taxable_amount += taxable;
          emirateOutputs[emirate].vat_amount += vat;
        } else {
          emirateOutputs['DUBAI'].taxable_amount += taxable;
          emirateOutputs['DUBAI'].vat_amount += vat;
        }
      }
    }

    // 2. Fetch Supplier Invoices (Inputs)
    const { data: supplierInvoices } = await supabase
      .from('supplier_invoices')
      .select('*')
      .gte('invoice_date', start)
      .lte('invoice_date', end)
      .in('status', ['APPROVED', 'SCHEDULED', 'PARTIALLY_PAID', 'PAID']);

    // Supplier TRN lives on the LPO (purchase_orders.supplier_trn), not the
    // supplier registry — resolve it per PO to decide standard vs reverse-charge.
    const poIds = Array.from(new Set((supplierInvoices || []).map((i: any) => i.po_id).filter(Boolean)));
    const poTrn = new Map<string, string>();
    if (poIds.length) {
      const { data: pos } = await supabase.from('purchase_orders').select('id, supplier_trn').in('id', poIds);
      for (const p of pos || []) poTrn.set((p as any).id, (p as any).supplier_trn || '');
    }

    let box9Taxable = 0;
    let box9Vat = 0;
    let box3Taxable = 0; // Reverse charge (RCM)
    let box3Vat = 0;

    for (const inv of supplierInvoices || []) {
      const taxable = Number(inv.taxable_amount || 0);
      const vat = Number(inv.vat_amount || 0);
      const supplierTrn = inv.po_id ? (poTrn.get(inv.po_id) || '') : '';

      // If supplier has no UAE TRN, treat it as import/RCM
      const isRcm = !supplierTrn || supplierTrn.trim() === '';

      if (isRcm) {
        box3Taxable += taxable;
        box3Vat += vat;
      } else {
        box9Taxable += taxable;
        box9Vat += vat;
      }
    }

    // Output Summing
    let totalOutputTaxable = 0;
    let totalOutputVat = 0;
    for (const key in emirateOutputs) {
      emirateOutputs[key].taxable_amount = round2(emirateOutputs[key].taxable_amount);
      emirateOutputs[key].vat_amount = round2(emirateOutputs[key].vat_amount);
      totalOutputTaxable += emirateOutputs[key].taxable_amount;
      totalOutputVat += emirateOutputs[key].vat_amount;
    }

    totalOutputTaxable += box3Taxable;
    totalOutputVat += box3Vat;

    // Compile Output values
    const box8 = {
      taxable_amount: round2(totalOutputTaxable),
      vat_amount: round2(totalOutputVat)
    };

    // Compile Input values
    const box9 = {
      taxable_amount: round2(box9Taxable),
      vat_amount: round2(box9Vat)
    };

    const box10 = {
      taxable_amount: round2(box3Taxable),
      vat_amount: round2(box3Vat)
    };

    const totalInputTaxable = box9.taxable_amount + box10.taxable_amount;
    const totalInputVat = box9.vat_amount + box10.vat_amount;

    const box11 = {
      taxable_amount: round2(totalInputTaxable),
      vat_amount: round2(totalInputVat)
    };

    const netVatDue = box8.vat_amount - box11.vat_amount;

    return {
      period_id: periodId,
      period_name: period.name,
      start_date: start,
      end_date: end,
      box1_abu_dhabi: emirateOutputs['ABU_DHABI'],
      box1_dubai: emirateOutputs['DUBAI'],
      box1_sharjah: emirateOutputs['SHARJAH'],
      box1_ajman: emirateOutputs['AJMAN'],
      box1_umm_al_quwain: emirateOutputs['UMM_AL_QUWAIN'],
      box1_ras_al_khaimah: emirateOutputs['RAS_AL_KHAIMAH'],
      box1_fujairah: emirateOutputs['FUJAIRAH'],
      box2_tourist_refunds: { taxable_amount: 0, vat_amount: 0 },
      box3_reverse_charge: { taxable_amount: round2(box3Taxable), vat_amount: round2(box3Vat) },
      box4_zero_rated: round2(box4ZeroRated),
      box5_exempt: round2(box5Exempt),
      box6_goods_imported: { taxable_amount: 0, vat_amount: 0 },
      box7_adjustments: { taxable_amount: 0, vat_amount: 0 },
      box8_total_outputs: box8,
      box9_standard_rated_expenses: box9,
      box10_reverse_charge_expenses: box10,
      box11_total_inputs: box11,
      box12_total_output_tax: box8.vat_amount,
      box13_total_input_tax: box11.vat_amount,
      box14_net_vat_due: round2(netVatDue)
    };
  }
};
export default vatService;
