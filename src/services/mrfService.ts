// ============================================================
// JEET ERP — Material Requisition Form (MRF) & Issue Service
// ============================================================

import { supabase } from '@/lib/supabase';
import { stockTransactionService } from './stockTransactionService';
import { eventService } from './eventService';
import type { MaterialRequisition, MRFItem, MRFStatus } from '@/types/stock.types';

export const mrfService = {
  /**
   * Creates a new Material Requisition Form and its item lines in a transaction.
   */
  async createMRF(
    mrf: Omit<MaterialRequisition, 'id' | 'mrf_number' | 'created_at' | 'updated_at' | 'requested_by'>,
    items: Array<Omit<MRFItem, 'id' | 'mrf_id' | 'qty_approved' | 'qty_issued'>>
  ): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required to create MRF.');

      // 1. Insert MRF Header
      const { data: newMrf, error: mrfErr } = await supabase
        .from('material_requisitions')
        .insert({
          project_id: mrf.project_id,
          requested_by: user.id,
          location_id: mrf.location_id,
          status: mrf.status || 'DRAFT',
          needed_by: mrf.needed_by,
          notes: mrf.notes || null
        })
        .select('id, mrf_number')
        .single();

      if (mrfErr) throw mrfErr;

      // 2. Insert Items
      const itemsToInsert = items.map(it => ({
        mrf_id: newMrf.id,
        stock_item_id: it.stock_item_id,
        qty_requested: it.qty_requested,
        qty_approved: mrf.status === 'APPROVED' ? it.qty_requested : 0.000,
        qty_issued: 0.000,
        notes: it.notes || null
      }));

      const { error: itemsErr } = await supabase
        .from('mrf_items')
        .insert(itemsToInsert);

      if (itemsErr) throw itemsErr;

      // 3. Emit event if submitted
      if (mrf.status === 'SUBMITTED') {
        await eventService.emitEvent(
          'timesheet.submitted', // Reuse notification rule or emit custom event
          'PROJECT',
          newMrf.id,
          mrf.project_id,
          {
            mrf_number: newMrf.mrf_number,
            needed_by: mrf.needed_by
          },
          user.id
        );
      }

      return newMrf.id;
    } catch (err) {
      console.error('Error creating MRF:', err);
      throw err;
    }
  },

  /**
   * Retrieves MRF lists.
   */
  async getMRFs(filters?: { project_id?: string; status?: MRFStatus }): Promise<MaterialRequisition[]> {
    // material_requisitions has no FK to projects/profiles in this DB → those
    // embeds PGRST200. Embed stock_locations; resolve the rest separately.
    let query = supabase
      .from('material_requisitions')
      .select(`
        *,
        stock_locations(name)
      `)
      .order('created_at', { ascending: false });

    if (filters?.project_id) query = query.eq('project_id', filters.project_id);
    if (filters?.status) query = query.eq('status', filters.status);

    const { data, error } = await query;
    if (error) throw error;
    const rows = data || [];

    const projectIds = [...new Set(rows.map((r: any) => r.project_id).filter(Boolean))];
    const reqIds = [...new Set(rows.map((r: any) => r.requested_by).filter(Boolean))];
    const [projRes, profRes] = await Promise.all([
      projectIds.length ? supabase.from('projects').select('id, project_number, name').in('id', projectIds) : Promise.resolve({ data: [] as any[] }),
      reqIds.length ? supabase.from('profiles').select('id, full_name').in('id', reqIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const projMap = new Map((projRes.data || []).map((p: any) => [p.id, p]));
    const profMap = new Map((profRes.data || []).map((p: any) => [p.id, p.full_name]));

    return rows.map((row: any) => ({
      ...row,
      project_name: projMap.get(row.project_id)?.name,
      project_number: projMap.get(row.project_id)?.project_number,
      requester_name: row.requested_by ? profMap.get(row.requested_by) : undefined,
      location_name: row.stock_locations?.name
    })) as MaterialRequisition[];
  },

  /**
   * Retrieves details of a single MRF and its items.
   */
  async getMRFDetail(id: string): Promise<MaterialRequisition> {
    // Embed stock_locations + mrf_items (safe). Resolve project (incl. boq_id,
    // needed by issueMRF) and requester via separate keyed lookups.
    const { data: mrf, error: mrfErr } = await supabase
      .from('material_requisitions')
      .select(`
        *,
        stock_locations(name)
      `)
      .eq('id', id)
      .single();

    if (mrfErr) throw mrfErr;

    let projectRow: any = null;
    if (mrf.project_id) {
      const { data } = await supabase.from('projects').select('project_number, name, boq_id').eq('id', mrf.project_id).maybeSingle();
      projectRow = data;
    }
    let requesterName: string | undefined;
    if (mrf.requested_by) {
      const { data } = await supabase.from('profiles').select('full_name').eq('id', mrf.requested_by).maybeSingle();
      requesterName = data?.full_name;
    }

    const { data: items, error: itemsErr } = await supabase
      .from('mrf_items')
      .select(`
        *,
        stock_items(
          pricing_items(item_code, description, unit)
        )
      `)
      .eq('mrf_id', id);

    if (itemsErr) throw itemsErr;

    const formattedItems = (items || []).map(it => ({
      ...it,
      item_code: it.stock_items?.pricing_items?.item_code,
      description: it.stock_items?.pricing_items?.description,
      unit: it.stock_items?.pricing_items?.unit
    }));

    return {
      ...mrf,
      projects: projectRow || undefined, // preserve shape used by issueMRF (boq_id, name, number)
      project_name: projectRow?.name,
      project_number: projectRow?.project_number,
      requester_name: requesterName,
      location_name: mrf.stock_locations?.name,
      items: formattedItems
    } as MaterialRequisition;
  },

  /**
   * Approves an MRF and sets reserved balances.
   */
  async approveMRF(id: string, approvedItems: Array<{ id: string; qty_approved: number }>): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required to approve MRF.');

      // Fetch MRF details
      const mrf: any = await this.getMRFDetail(id);

      // Loop and update approved quantities + set stock reserves
      for (const appItem of approvedItems) {
        // Fetch current MRF item
        const mrfItem = mrf.items?.find((it: any) => it.id === appItem.id);
        if (!mrfItem) continue;

        // Update mrf_items
        const { error: updateErr } = await supabase
          .from('mrf_items')
          .update({ qty_approved: appItem.qty_approved })
          .eq('id', appItem.id);

        if (updateErr) throw updateErr;

        // Update qty_reserved in stock_balances for the warehouse
        const { data: balance } = await supabase
          .from('stock_balances')
          .select('id, qty_reserved')
          .eq('stock_item_id', mrfItem.stock_item_id)
          .eq('location_id', mrf.location_id)
          .maybeSingle();

        if (balance) {
          await supabase
            .from('stock_balances')
            .update({ qty_reserved: Number(balance.qty_reserved) + appItem.qty_approved })
            .eq('id', balance.id);
        } else {
          // If no balance exists, insert one with reserved qty
          await supabase
            .from('stock_balances')
            .insert({
              stock_item_id: mrfItem.stock_item_id,
              location_id: mrf.location_id,
              qty_on_hand: 0.000,
              qty_reserved: appItem.qty_approved,
              avg_unit_cost: 0.0000
            });
        }
      }

      // Update MRF status
      const { error: statusErr } = await supabase
        .from('material_requisitions')
        .update({ status: 'APPROVED', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (statusErr) throw statusErr;

    } catch (err) {
      console.error('Error approving MRF:', err);
      throw err;
    }
  },

  /**
   * Issues material against an approved MRF.
   * Decrements stock balance, decrements reserved balance, and checks project BOQ limits.
   */
  async issueMRF(
    id: string,
    issueItems: Array<{ id: string; qty_to_issue: number; serialNumbers?: string[] }>,
    options?: { overrideNegativeStock?: boolean; overrideReason?: string }
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required to issue MRF.');

      // Fetch MRF details
      const mrf: any = await this.getMRFDetail(id);
      if (mrf.status !== 'APPROVED' && mrf.status !== 'PARTIALLY_ISSUED') {
        throw new Error('Material can only be issued against APPROVED or PARTIALLY_ISSUED requisitions.');
      }

      // Fetch Project BOQ detail
      let boqItems: any[] = [];
      if (mrf.projects?.boq_id) {
        const { data: boq } = await supabase
          .from('boqs')
          .select('items')
          .eq('id', mrf.projects.boq_id)
          .maybeSingle();
        if (boq && Array.isArray(boq.items)) {
          boqItems = boq.items;
        }
      }

      for (const issue of issueItems) {
        const mrfItem = mrf.items?.find((it: any) => it.id === issue.id);
        if (!mrfItem || issue.qty_to_issue <= 0) continue;

        const remainingToIssue = mrfItem.qty_approved - mrfItem.qty_issued;
        if (issue.qty_to_issue > remainingToIssue) {
          throw new Error(
            `Issue Quantity Exceeded: Attempting to issue ${issue.qty_to_issue} for "${mrfItem.description}", but only ${remainingToIssue} is approved and pending.`
          );
        }

        // Fetch current avg cost
        const { data: balance } = await supabase
          .from('stock_balances')
          .select('avg_unit_cost, qty_reserved')
          .eq('stock_item_id', mrfItem.stock_item_id)
          .eq('location_id', mrf.location_id)
          .single();

        const currentCost = balance ? Number(balance.avg_unit_cost) : 0.0000;

        // Record stock transaction (triggers deduction onqty_on_hand)
        await stockTransactionService.recordTransaction({
          type: 'ISSUE_TO_PROJECT',
          stock_item_id: mrfItem.stock_item_id,
          location_id: mrf.location_id,
          qty: -issue.qty_to_issue, // negative
          unit_cost: currentCost,
          total_value: issue.qty_to_issue * currentCost,
          source_type: 'MRF',
          source_id: mrf.id,
          project_id: mrf.project_id,
          reason: mrf.notes
        }, {
          serialNumbers: issue.serialNumbers,
          overrideNegativeStock: options?.overrideNegativeStock,
          overrideReason: options?.overrideReason
        });

        // Decrement reserved balance
        const updatedRes = Math.max(0, (balance ? Number(balance.qty_reserved) : 0) - issue.qty_to_issue);
        await supabase
          .from('stock_balances')
          .update({ qty_reserved: updatedRes })
          .eq('stock_item_id', mrfItem.stock_item_id)
          .eq('location_id', mrf.location_id);

        // Update qty_issued on MRF item
        const nextIssued = Number(mrfItem.qty_issued) + issue.qty_to_issue;
        await supabase
          .from('mrf_items')
          .update({ qty_issued: nextIssued })
          .eq('id', issue.id);

        // BOQ Quantity Variance Check & Warning Alert
        if (boqItems.length > 0) {
          // Resolve pricing item item_code
          const { data: sItem } = await supabase
            .from('stock_items')
            .select('pricing_items(item_code, description)')
            .eq('id', mrfItem.stock_item_id)
            .single();
          const itemCode = (sItem as any)?.pricing_items?.item_code;
          const itemName = (sItem as any)?.pricing_items?.description || 'Item';

          const boqMatch = boqItems.find(bit => bit.item_code === itemCode);
          if (boqMatch) {
            const boqQtyAllowed = Number(boqMatch.quantity || 0);

            // Fetch total issued qty of this item to this project
            const { data: txs } = await supabase
              .from('stock_transactions')
              .select('qty')
              .eq('project_id', mrf.project_id)
              .eq('stock_item_id', mrfItem.stock_item_id)
              .eq('type', 'ISSUE_TO_PROJECT');

            const totalIssuedToProject = (txs || []).reduce((sum, t) => sum + Math.abs(Number(t.qty)), 0);

            if (totalIssuedToProject > boqQtyAllowed) {
              const variance = totalIssuedToProject - boqQtyAllowed;
              await eventService.emitEvent(
                'stock.consumption_over_boq',
                'PROJECT',
                mrf.project_id,
                mrf.project_id,
                {
                  item_name: itemName,
                  boq_qty: boqQtyAllowed,
                  issued_qty: totalIssuedToProject,
                  variance_qty: variance,
                  unit: mrfItem.unit || 'EA',
                  project_name: mrf.projects?.name,
                  project_number: mrf.projects?.project_number
                },
                user.id
              );
            }
          }
        }
      }

      // Re-evaluate MRF header status
      const updatedMrf = await this.getMRFDetail(id);
      const allIssued = updatedMrf.items?.every(it => Number(it.qty_issued) >= Number(it.qty_approved));
      const nextStatus: MRFStatus = allIssued ? 'ISSUED' : 'PARTIALLY_ISSUED';

      await supabase
        .from('material_requisitions')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

    } catch (err) {
      console.error('Error issuing MRF:', err);
      throw err;
    }
  },

  /**
   * Records a return of unused materials from site to warehouse.
   * Credits the project (reduces project actuals) and increases inventory.
   */
  async returnFromSite(params: {
    project_id: string;
    stock_item_id: string;
    location_id: string;
    qty: number;
    serialNumbers?: string[];
    reason?: string;
  }): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required to record site return.');

      // Fetch item description and current cost
      const { data: stockItem } = await supabase
        .from('stock_items')
        .select('*, pricing_items(description)')
        .eq('id', params.stock_item_id)
        .single();

      const { data: balance } = await supabase
        .from('stock_balances')
        .select('avg_unit_cost')
        .eq('stock_item_id', params.stock_item_id)
        .eq('location_id', params.location_id)
        .maybeSingle();

      const currentCost = balance ? Number(balance.avg_unit_cost) : 0.0000;

      // Record RETURN_FROM_SITE (+qty, valued at current cost)
      const txId = await stockTransactionService.recordTransaction({
        type: 'RETURN_FROM_SITE',
        stock_item_id: params.stock_item_id,
        location_id: params.location_id,
        qty: params.qty, // positive
        unit_cost: currentCost,
        total_value: params.qty * currentCost,
        source_type: 'MANUAL',
        source_id: null,
        project_id: params.project_id,
        reason: params.reason || 'Returned unused from project site.'
      }, {
        serialNumbers: params.serialNumbers
      });

      return txId;
    } catch (err) {
      console.error('Error returning from site:', err);
      throw err;
    }
  }
};

export default mrfService;
