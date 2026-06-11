import { supabase } from '@/lib/supabase';
import type { FixedAsset, DepreciationPeriodRow } from '@/types/asset.types';
import { depreciationService } from './depreciationService';
import * as XLSX from 'xlsx';

export const fixedAssetService = {
  /**
   * Fetches all fixed assets.
   */
  async getFixedAssets(): Promise<FixedAsset[]> {
    const { data, error } = await supabase
      .from('fixed_assets')
      .select(`
        *,
        pricing_suppliers:supplier_id (
          name
        ),
        employees:custodian_id (
          full_name_en
        ),
        vehicles:linked_vehicle_id (
          vehicle_code
        ),
        tools:linked_tool_id (
          tool_number
        )
      `)
      .eq('is_active', true)
      .order('asset_number', { ascending: true });

    if (error) throw error;

    return (data || []).map(row => ({
      ...row,
      supplier_name: row.pricing_suppliers?.name,
      custodian_name: row.employees?.full_name_en,
      vehicle_code: row.vehicles?.vehicle_code,
      tool_number: row.tools?.tool_number
    })) as FixedAsset[];
  },

  /**
   * Fetches a specific fixed asset by its ID, along with its depreciation schedule.
   */
  async getFixedAssetById(id: string): Promise<{ asset: FixedAsset; schedule: DepreciationPeriodRow[] } | null> {
    const { data: asset, error: assetErr } = await supabase
      .from('fixed_assets')
      .select(`
        *,
        pricing_suppliers:supplier_id (
          name
        ),
        employees:custodian_id (
          full_name_en
        ),
        vehicles:linked_vehicle_id (
          vehicle_code
        ),
        tools:linked_tool_id (
          tool_number
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (assetErr) throw assetErr;
    if (!asset) return null;

    const { data: schedule, error: schedErr } = await supabase
      .from('depreciation_schedule')
      .select('*')
      .eq('asset_id', id)
      .order('period_month', { ascending: true });

    if (schedErr) throw schedErr;

    const formattedAsset = {
      ...asset,
      supplier_name: asset.pricing_suppliers?.name,
      custodian_name: asset.employees?.full_name_en,
      vehicle_code: asset.vehicles?.vehicle_code,
      tool_number: asset.tools?.tool_number
    } as FixedAsset;

    return {
      asset: formattedAsset,
      schedule: (schedule || []) as DepreciationPeriodRow[]
    };
  },

  /**
   * Creates a new fixed asset, generates its depreciation schedule, and links it to a vehicle/tool.
   */
  async createFixedAsset(asset: Omit<FixedAsset, 'id' | 'asset_number' | 'accumulated_depreciation' | 'net_book_value' | 'status' | 'is_active' | 'created_at' | 'updated_at'>): Promise<FixedAsset> {
    const now = new Date().toISOString();
    
    // Generate the depreciation schedule using the pure service
    const generatedSched = depreciationService.generateSchedule(
      asset.acquisition_date,
      asset.acquisition_cost,
      asset.salvage_value,
      asset.useful_life_months
    );

    // Initial values
    const accumulatedDep = 0;
    const netBookValue = asset.acquisition_cost;
    const status = 'ACTIVE';

    // Insert Fixed Asset
    const { data: newAsset, error: assetErr } = await supabase
      .from('fixed_assets')
      .insert({
        ...asset,
        accumulated_depreciation: accumulatedDep,
        net_book_value: netBookValue,
        status,
        is_active: true
      })
      .select()
      .single();

    if (assetErr) throw assetErr;

    // Insert schedule rows
    const scheduleToInsert = generatedSched.map(row => ({
      asset_id: newAsset.id,
      period_month: row.period_month,
      opening_nbv: row.opening_nbv,
      depreciation_amount: row.depreciation_amount,
      closing_nbv: row.closing_nbv,
      accumulated: row.accumulated,
      posted: false
    }));

    const { error: schedErr } = await supabase
      .from('depreciation_schedule')
      .insert(scheduleToInsert);

    if (schedErr) throw schedErr;

    // Link vehicle or tool if needed
    if (asset.linked_vehicle_id) {
      await supabase
        .from('vehicles')
        .update({
          fixed_asset_id: newAsset.id,
          updated_at: now
        })
        .eq('id', asset.linked_vehicle_id);
    } else if (asset.linked_tool_id) {
      // High-value tool link
      await supabase
        .from('tools')
        .update({
          // link tool to asset if tool table has asset fields or notes
          notes: `Linked to Fixed Asset Register: ${newAsset.asset_number}`,
          updated_at: now
        })
        .eq('id', asset.linked_tool_id);
    }

    return newAsset as FixedAsset;
  },

  /**
   * Executes a monthly depreciation run: posts all pending schedule rows for a given period month,
   * updates the accumulated depreciation and net book values of assets, and caps fully-depreciated ones.
   */
  async runMonthlyDepreciation(periodMonth: string): Promise<DepreciationPeriodRow[]> {
    const formattedPeriod = periodMonth.substring(0, 7) + '-01'; // YYYY-MM-01 format
    const now = new Date().toISOString();

    // 1. Fetch unposted schedule rows for this month
    const { data: pendingRows, error: fetchErr } = await supabase
      .from('depreciation_schedule')
      .select(`
        *,
        fixed_assets:asset_id (
          id,
          salvage_value,
          acquisition_cost
        )
      `)
      .eq('period_month', formattedPeriod)
      .eq('posted', false);

    if (fetchErr) throw fetchErr;

    const postedRows: DepreciationPeriodRow[] = [];

    // 2. Post each depreciation row and update the asset balances
    for (const row of pendingRows || []) {
      // Update schedule row as posted
      const { data: updatedRow, error: schedUpdateErr } = await supabase
        .from('depreciation_schedule')
        .update({
          posted: true
        })
        .eq('id', row.id)
        .select()
        .single();

      if (schedUpdateErr) throw schedUpdateErr;
      postedRows.push(updatedRow as DepreciationPeriodRow);

      // Determine asset status
      const salvage = Number(row.fixed_assets?.salvage_value || 0);
      const isFullyDep = row.closing_nbv <= salvage;
      const assetStatus = isFullyDep ? 'FULLY_DEPRECIATED' : 'ACTIVE';

      // Update Fixed Asset record
      await supabase
        .from('fixed_assets')
        .update({
          accumulated_depreciation: row.accumulated,
          net_book_value: row.closing_nbv,
          status: assetStatus,
          updated_at: now
        })
        .eq('id', row.asset_id);
    }

    return postedRows;
  },

  /**
   * Generates double-entry journal entries representing period depreciation for exporting.
   */
  async generateDepreciationJournal(periodMonth: string) {
    const formattedPeriod = periodMonth.substring(0, 7) + '-01';

    const { data: rows, error } = await supabase
      .from('depreciation_schedule')
      .select(`
        *,
        fixed_assets:asset_id (
          asset_number,
          name,
          category
        )
      `)
      .eq('period_month', formattedPeriod)
      .eq('posted', true);

    if (error) throw error;

    const journalLines: any[] = [];

    for (const r of rows || []) {
      const assetNum = r.fixed_assets?.asset_number || 'N/A';
      const name = r.fixed_assets?.name || 'Asset';
      const depAmount = Number(r.depreciation_amount);

      if (depAmount === 0) continue;

      // 1. Debit Depreciation Expense
      journalLines.push({
        Date: formattedPeriod,
        Reference: `DEP-${formattedPeriod.substring(0, 7)}-${assetNum}`,
        'GL Account Code': '52000',
        'GL Account Name': 'Depreciation Expense',
        Description: `Depreciation Expense - Asset ${assetNum} (${name})`,
        Debit: depAmount,
        Credit: 0,
        Category: r.fixed_assets?.category
      });

      // 2. Credit Accumulated Depreciation
      journalLines.push({
        Date: formattedPeriod,
        Reference: `DEP-${formattedPeriod.substring(0, 7)}-${assetNum}`,
        'GL Account Code': '18000',
        'GL Account Name': 'Accumulated Depreciation',
        Description: `Accumulated Dep. Offset - Asset ${assetNum} (${name})`,
        Debit: 0,
        Credit: depAmount,
        Category: r.fixed_assets?.category
      });
    }

    return journalLines;
  },

  /**
   * Triggers download of the depreciation journal entries spreadsheet in Excel.
   */
  async exportJournalToExcel(periodMonth: string, filename?: string) {
    const journalLines = await this.generateDepreciationJournal(periodMonth);
    const fname = filename || `Depreciation_Journal_${periodMonth.substring(0, 7)}.xlsx`;

    const ws = XLSX.utils.json_to_sheet(journalLines);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Depreciation Journal');

    // Column sizing
    ws['!cols'] = [
      { wch: 12 }, // Date
      { wch: 22 }, // Reference
      { wch: 16 }, // GL Account Code
      { wch: 25 }, // GL Account Name
      { wch: 40 }, // Description
      { wch: 15 }, // Debit
      { wch: 15 }, // Credit
      { wch: 18 }  // Category
    ];

    if (typeof window !== 'undefined') {
      XLSX.writeFile(wb, fname);
    }
  }
};
export default fixedAssetService;
