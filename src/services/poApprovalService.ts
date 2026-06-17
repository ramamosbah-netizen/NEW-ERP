// ============================================================
// JEET ERP — PO Approval Workflow Service
// ============================================================

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { eventService } from './eventService';
import { commitmentService } from './commitmentService';
import { supplierInvoiceService } from './supplierInvoiceService';
import type { PurchaseOrder, POApprovalStage, POApprovalAction } from '@/types/po.types';

export const poApprovalService = {
  /**
   * Determines the required approval stages based on the gross PO total.
   * Total <= 50,000 AED (including VAT) -> Commercial Manager stage only.
   * Total > 50,000 AED (including VAT) -> Commercial Manager + General Manager stages.
   */
  determineApprovalStages(totalWithVat: number): POApprovalStage[] {
    if (totalWithVat <= 50000.00) {
      return ['COMMERCIAL'];
    }
    return ['COMMERCIAL', 'GM'];
  },

  /**
   * Validates a Purchase Order before submission.
   * Enforces that manual POs > 10,000 AED require a justification.
   */
  validatePOSubmission(po: Partial<PurchaseOrder>): string[] {
    const errors: string[] = [];

    if (po.origin === 'MANUAL') {
      const grossTotal = po.total || 0;
      if (grossTotal > 10000.00 && (!po.no_comparison_justification || po.no_comparison_justification.trim() === '')) {
        errors.push('Manual Purchase Orders exceeding 10,000 AED require a justification for skipping the comparison sheet.');
      }
    }

    if (!po.supplier_id) {
      errors.push('A supplier must be selected.');
    }

    if (po.po_type !== 'OVERHEAD' && !po.project_id) {
      errors.push('A project must be assigned unless PO is for overhead.');
    }

    return errors;
  },

  /**
   * Checks if a user is authorized to approve a PO at a given stage.
   * Guard: Users cannot approve POs they created.
   * Role: Only admin or manager roles can approve.
   */
  async checkApprovalPermission(
    po: PurchaseOrder,
    userId: string,
    stage: POApprovalStage
  ): Promise<{ allowed: boolean; reason?: string }> {
    // 1. Self-approval guard
    if (po.created_by === userId) {
      return { allowed: false, reason: 'Self-Approval Guard: You cannot approve a Purchase Order that you created.' };
    }

    // 2. Dynamic permission check via RPC
    const { data: allowed, error } = await supabase.rpc('has_permission', {
      p_user_id: userId,
      p_perm_key: 'po.approve',
      p_creator_id: po.created_by
    });

    if (error) {
      logger.error('Error verifying permissions via RPC:', error);
      return { allowed: false, reason: 'Failed to verify approval authorization.' };
    }

    if (!allowed) {
      return { allowed: false, reason: 'Permission Denied: Your account does not have the required approval permissions.' };
    }

    return { allowed: true };
  },

  /**
   * Submits a PO for approval, moving it to PENDING_APPROVAL.
   */
  async submitForApproval(poId: string, actorUserId?: string): Promise<void> {
    try {
      // 1. Fetch PO to validate details
      const { data: po, error: poErr } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', poId)
        .single();

      if (poErr || !po) throw new Error('Purchase Order not found');
      if (po.status !== 'DRAFT') {
        throw new Error(`Only Draft POs can be submitted for approval. Current status is ${po.status}`);
      }

      // 2. Validate
      const validationErrors = this.validatePOSubmission(po);
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(' | '));
      }

      // 3. Update Status
      const { error: updateErr } = await supabase
        .from('purchase_orders')
        .update({
          status: 'PENDING_APPROVAL',
          updated_at: new Date().toISOString()
        })
        .eq('id', poId);

      if (updateErr) throw updateErr;

      // 4. Emit event through eventService (no direct notifications!)
      await eventService.emitEvent(
        'po.submitted',
        'PROJECT', // or LPO/SUPPLIER
        po.id,
        po.project_id || undefined,
        {
          po_number: po.po_number,
          total: po.total,
          supplier_name: po.supplier_name,
          stages: this.determineApprovalStages(po.total),
          created_by_id: po.created_by
        },
        actorUserId
      );

    } catch (err) {
      logger.error('Error submitting PO for approval:', err);
      throw err;
    }
  },

  /**
   * Processes a PO sign-off (APPROVE or REJECT).
   */
  async processApproval(
    poId: string,
    stage: POApprovalStage,
    action: POApprovalAction,
    comment: string | null,
    actorUserId: string
  ): Promise<void> {
    try {
      // 1. Fetch PO
      const { data: po, error: poErr } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', poId)
        .single();

      if (poErr || !po) throw new Error('Purchase order not found');

      // 2. Validate permissions
      const authCheck = await this.checkApprovalPermission(po as PurchaseOrder, actorUserId, stage);
      if (!authCheck.allowed) {
        throw new Error(authCheck.reason);
      }

      // 3. Insert approval record
      const { error: logErr } = await supabase
        .from('po_approvals')
        .insert({
          po_id: poId,
          stage,
          action,
          comment,
          approver_id: actorUserId
        });

      if (logErr) throw logErr;

      // 4. Handle state machine transition
      if (action === 'REJECTED') {
        // Rejects return to DRAFT
        const { error: updateErr } = await supabase
          .from('purchase_orders')
          .update({
            status: 'DRAFT',
            updated_at: new Date().toISOString()
          })
          .eq('id', poId);

        if (updateErr) throw updateErr;

        // Emit rejection event
        await eventService.emitEvent(
          'po.rejected',
          'PROJECT',
          po.id,
          po.project_id || undefined,
          {
            po_number: po.po_number,
            stage,
            comment,
            rejected_by: actorUserId,
            created_by_id: po.created_by
          },
          actorUserId
        );
      } else {
        // action === 'APPROVED'
        if (po.project_id) {
          try {
            const commitments = await commitmentService.getProjectCostCommitments(po.project_id);
            // Find unique systems in this PO
            const { data: poItems } = await supabase
              .from('po_items')
              .select('system')
              .eq('po_id', poId);
              
            if (poItems && poItems.length > 0) {
              const poSystems = [...new Set(poItems.map(it => it.system).filter(Boolean))];
              for (const sys of poSystems) {
                const comm = commitments.find(c => c.system === sys);
                if (comm && comm.committedCost > comm.budgetCost && comm.budgetCost > 0) {
                  const pct = Math.round((comm.committedCost / comm.budgetCost) * 100);
                  
                  // Emit po.budget_exceeded event
                  await eventService.emitEvent(
                    'po.budget_exceeded',
                    'PROJECT',
                    poId,
                    po.project_id,
                    {
                      po_number: po.po_number,
                      system: sys,
                      system_name: comm.systemName,
                      budget_cost: comm.budgetCost,
                      committed_cost: comm.committedCost,
                      percentage: pct,
                      approved_by: actorUserId,
                      comment
                    },
                    actorUserId
                  );
                }
              }
            }
          } catch (commErr) {
            logger.error('Failed to check budget commitments in approval step:', commErr);
          }
        }

        const requiredStages = this.determineApprovalStages(po.total);
        const isFinalStage = 
          (stage === 'COMMERCIAL' && requiredStages.length === 1) || 
          (stage === 'GM');

        if (isFinalStage) {
          // Final sign-off complete
          const { error: updateErr } = await supabase
            .from('purchase_orders')
            .update({
              status: 'APPROVED',
              updated_at: new Date().toISOString()
            })
            .eq('id', poId);

          if (updateErr) throw updateErr;

          // Approved LPO → create a DRAFT payable ("action to spend money") in
          // AP, importing any supplier proforma. Best-effort; never blocks approval.
          try {
            await supplierInvoiceService.createExpectedFromPO(poId);
          } catch (apErr) {
            logger.warn('Could not auto-create AP draft for approved LPO:', apErr);
          }

          // Emit approval event
          await eventService.emitEvent(
            'po.approved',
            'PROJECT',
            po.id,
            po.project_id || undefined,
            {
              po_number: po.po_number,
              total: po.total,
              supplier_name: po.supplier_name,
              approved_by: actorUserId,
              created_by_id: po.created_by
            },
            actorUserId
          );
        } else {
          // If first stage of 2-stage approval is done, stay PENDING_APPROVAL and notify GM
          // (the platform handles tasks / notifications dynamically from events)
          await eventService.emitEvent(
            'po.submitted', // emit another submission event specifying remaining GM stage
            'PROJECT',
            po.id,
            po.project_id || undefined,
            {
              po_number: po.po_number,
              total: po.total,
              supplier_name: po.supplier_name,
              stages: ['GM'],
              commercial_approved_by: actorUserId,
              created_by_id: po.created_by
            },
            actorUserId
          );
        }
      }
    } catch (err) {
      logger.error('Error processing PO approval:', err);
      throw err;
    }
  }
};

export default poApprovalService;
