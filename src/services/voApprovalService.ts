// ============================================================
// JEET ERP — Variation Order Approval Service
// Location: src/services/voApprovalService.ts
// Handles threshold routing, self-approval guards, and transition logic.
// ============================================================

import { supabase } from '@/lib/supabase';
import type { VariationOrder } from '@/types/vo.types';

export const voApprovalService = {
  /**
   * Evaluates if a user is permitted to approve a Variation Order.
   * Enforces self-approval guard (a user cannot approve a VO they created).
   * Evaluates thresholds:
   *   - Sell Amount <= 25,000 AED -> Commercial Manager ('commercial_mgr') or GM ('gm') or Admin ('admin')
   *   - Sell Amount > 25,000 AED -> General Manager ('gm') or Admin ('admin')
   */
  async evaluateApprovalPermissions(
    vo: VariationOrder,
    userId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // 1. Self-approval guard
    if (vo.created_by === userId) {
      // Fetch user profile to check if they are admin. Admins can bypass self-approval guard for testing/emergencies.
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
        
      if (profile && profile.role !== 'admin') {
        return {
          allowed: false,
          reason: 'Self-Approval Guard: You cannot approve a Variation Order that you created.'
        };
      }
    }

    // 2. Fetch current user's role
    const { data: userRoleData, error: roleError } = await supabase
      .from('user_roles')
      .select('roles(role_key)')
      .eq('user_id', userId);

    if (roleError || !userRoleData) {
      return { allowed: false, reason: 'Failed to retrieve user authorization roles.' };
    }

    const roles = userRoleData.map((ur: any) => ur.roles?.role_key).filter(Boolean);
    const isAdmin = roles.includes('admin');
    const isGM = roles.includes('gm');
    const isCommercialMgr = roles.includes('commercial_mgr');

    if (isAdmin) {
      return { allowed: true };
    }

    // 3. Threshold check
    const sellVal = Math.abs(Number(vo.sell_amount || 0)); // handle signed math (omissions)

    if (sellVal <= 25000) {
      // Under or equal to 25k: Commercial Manager or GM
      if (isCommercialMgr || isGM) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Threshold Guard: This Variation Order (≤ 25,000 AED) requires Commercial Manager or GM approval.'
      };
    } else {
      // Over 25k: GM only
      if (isGM) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Threshold Guard: This Variation Order (> 25,000 AED) exceeds Commercial Manager threshold and requires GM approval.'
      };
    }
  }
};

export default voApprovalService;
