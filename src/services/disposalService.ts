import { supabase } from '@/lib/supabase';
import type { AssetDisposal } from '@/types/asset.types';
import { depreciationService } from './depreciationService';

export const disposalService = {
  /**
   * Fetches all disposal records.
   */
  async getDisposals(): Promise<AssetDisposal[]> {
    const { data, error } = await supabase
      .from('asset_disposals')
      .select(`
        *,
        fixed_assets:asset_id (
          asset_number,
          name
        )
      `)
      .order('disposal_date', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      ...row,
      asset_number: row.fixed_assets?.asset_number,
      asset_name: row.fixed_assets?.name
    })) as AssetDisposal[];
  },

  /**
   * Records a new asset disposal, stops future depreciation, computes gain/loss, and syncs statuses.
   */
  async disposeAsset(disposal: Omit<AssetDisposal, 'id' | 'nbv_at_disposal' | 'gain_loss' | 'created_at'>): Promise<AssetDisposal> {
    const now = new Date().toISOString();
    const disposalPeriod = depreciationService.getPeriodMonth(disposal.disposal_date);

    // 1. Fetch asset details
    const { data: asset, error: assetErr } = await supabase
      .from('fixed_assets')
      .select('*')
      .eq('id', disposal.asset_id)
      .single();

    if (assetErr) throw assetErr;
    if (!asset) throw new Error('Asset record not found');
    if (asset.status === 'DISPOSED') throw new Error('Asset is already disposed');

    // 2. Fetch all depreciation schedule rows for this asset
    const { data: schedule, error: schedErr } = await supabase
      .from('depreciation_schedule')
      .select('*')
      .eq('asset_id', disposal.asset_id)
      .order('period_month', { ascending: true });

    if (schedErr) throw schedErr;

    // Get Net Book Value at disposal date
    const nbvAtDisposal = depreciationService.getNbvAtPeriod(schedule || [], disposalPeriod);
    const gainLoss = depreciationService.calculateDisposalGainLoss(nbvAtDisposal, disposal.proceeds);

    // 3. Truncate unposted schedule rows beyond the disposal month
    const { error: truncateErr } = await supabase
      .from('depreciation_schedule')
      .delete()
      .eq('asset_id', disposal.asset_id)
      .gt('period_month', disposalPeriod);

    if (truncateErr) throw truncateErr;

    // 4. If there is an unposted schedule row for the disposal month itself, post it now
    const currentPeriodRow = (schedule || []).find(r => r.period_month === disposalPeriod && !r.posted);
    if (currentPeriodRow) {
      await supabase
        .from('depreciation_schedule')
        .update({ posted: true })
        .eq('id', currentPeriodRow.id);
    }

    // 5. Create disposal entry
    const { data: newDisposal, error: dispErr } = await supabase
      .from('asset_disposals')
      .insert({
        ...disposal,
        nbv_at_disposal: nbvAtDisposal,
        gain_loss: gainLoss
      })
      .select()
      .single();

    if (dispErr) throw dispErr;

    // 6. Update Fixed Asset details
    const finalAccum = Math.round((Number(asset.acquisition_cost) - nbvAtDisposal) * 100) / 100;
    const { error: assetUpdateErr } = await supabase
      .from('fixed_assets')
      .update({
        accumulated_depreciation: finalAccum,
        net_book_value: nbvAtDisposal,
        status: 'DISPOSED',
        disposal_date: disposal.disposal_date,
        disposal_proceeds: disposal.proceeds,
        disposal_method: disposal.method,
        updated_at: now
      })
      .eq('id', disposal.asset_id);

    if (assetUpdateErr) throw assetUpdateErr;

    // 7. Sync status to linked vehicle or tool if present
    if (asset.linked_vehicle_id) {
      const vehicleStatus = disposal.method === 'SALE' ? 'SOLD' : 'DISPOSED';
      await supabase
        .from('vehicles')
        .update({
          status: vehicleStatus,
          is_active: false, // Retired from active service
          updated_at: now
        })
        .eq('id', asset.linked_vehicle_id);
    } else if (asset.linked_tool_id) {
      // If linked tool, retire the tool
      await supabase
        .from('tools')
        .update({
          status: 'RETIRED',
          is_active: false,
          notes: `Asset disposed via ${disposal.method} on ${disposal.disposal_date}.`,
          updated_at: now
        })
        .eq('id', asset.linked_tool_id);
    }

    return newDisposal as AssetDisposal;
  }
};
export default disposalService;
