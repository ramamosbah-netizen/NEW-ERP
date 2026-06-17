// ============================================================
// JEET ERP — Tools & Equipment Register Service
// ============================================================

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import type { Tool, ToolAssignment, ToolMaintenance, ToolStatus, ToolCondition, ToolCategory } from '@/types/tool.types';

export const toolService = {
  /**
   * Retrieves all tools with filters.
   */
  async getTools(filters?: {
    category?: ToolCategory;
    status?: ToolStatus;
    condition?: ToolCondition;
    requires_calibration?: boolean;
    search?: string;
  }): Promise<Tool[]> {
    let query = supabase
      .from('tools')
      .select(`
        *,
        employees(full_name_en),
        stock_locations(name)
      `)
      .eq('is_active', true)
      .order('tool_number');

    if (filters?.category) query = query.eq('category', filters.category);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.condition) query = query.eq('condition', filters.condition);
    if (filters?.requires_calibration !== undefined) {
      query = query.eq('requires_calibration', filters.requires_calibration);
    }

    const { data, error } = await query;
    if (error) throw error;

    let results = (data || []).map(row => ({
      ...row,
      custodian_name: row.employees?.full_name_en,
      location_name: row.stock_locations?.name
    })) as Tool[];

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      results = results.filter(
        t =>
          t.tool_number.toLowerCase().includes(searchLower) ||
          t.name.toLowerCase().includes(searchLower) ||
          (t.brand_model && t.brand_model.toLowerCase().includes(searchLower)) ||
          (t.serial_no && t.serial_no.toLowerCase().includes(searchLower))
      );
    }

    return results;
  },

  /**
   * Retrieves a single tool by ID.
   */
  async getToolDetail(id: string): Promise<Tool> {
    const { data: tool, error: toolErr } = await supabase
      .from('tools')
      .select(`
        *,
        employees(full_name_en),
        stock_locations(name),
        pricing_suppliers(name),
        documents(title)
      `)
      .eq('id', id)
      .single();

    if (toolErr) throw toolErr;

    return {
      ...tool,
      custodian_name: tool.employees?.full_name_en,
      location_name: tool.stock_locations?.name,
      supplier_name: tool.pricing_suppliers?.name,
      calibration_cert_name: tool.documents?.title
    } as Tool;
  },

  /**
   * Creates a new tool in the register.
   */
  async createTool(tool: Omit<Tool, 'id' | 'tool_number' | 'created_at' | 'updated_at' | 'is_active'>): Promise<string> {
    let nextCalDue = null;
    if (tool.requires_calibration && tool.last_calibration_date && tool.calibration_interval_months) {
      const date = new Date(tool.last_calibration_date);
      date.setMonth(date.getMonth() + tool.calibration_interval_months);
      nextCalDue = date.toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('tools')
      .insert({
        name: tool.name,
        category: tool.category,
        brand_model: tool.brand_model || null,
        serial_no: tool.serial_no || null,
        purchase_date: tool.purchase_date || null,
        purchase_cost: tool.purchase_cost || null,
        supplier_id: tool.supplier_id || null,
        status: tool.status || 'AVAILABLE',
        current_custodian_id: tool.current_custodian_id || null,
        current_location_id: tool.current_location_id || null,
        requires_calibration: tool.requires_calibration || false,
        calibration_interval_months: tool.calibration_interval_months || null,
        last_calibration_date: tool.last_calibration_date || null,
        next_calibration_due: nextCalDue || tool.next_calibration_due || null,
        calibration_cert_document_id: tool.calibration_cert_document_id || null,
        condition: tool.condition || 'GOOD',
        photo_path: tool.photo_path || null,
        notes: tool.notes || null,
        is_active: true
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  },

  /**
   * Retrieves assignments history for a tool or custodian.
   */
  async getAssignments(filters?: { tool_id?: string; employee_id?: string }): Promise<ToolAssignment[]> {
    let query = supabase
      .from('tool_assignments')
      .select(`
        *,
        tools(tool_number, name),
        employees(full_name_en),
        profiles:issued_by(full_name),
        projects(project_number, name)
      `)
      .order('issue_date', { ascending: false });

    if (filters?.tool_id) query = query.eq('tool_id', filters.tool_id);
    if (filters?.employee_id) query = query.eq('issued_to', filters.employee_id);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(row => ({
      ...row,
      tool_number: row.tools?.tool_number,
      tool_name: row.tools?.name,
      issued_to_name: row.employees?.full_name_en,
      issued_by_name: row.profiles?.full_name,
      project_number: row.projects?.project_number,
      project_name: row.projects?.name
    })) as ToolAssignment[];
  },

  /**
   * Issues/Assigns a tool to an employee or project site.
   */
  async assignTool(
    assignment: Omit<ToolAssignment, 'id' | 'issue_date' | 'returned_date' | 'issued_by' | 'return_condition'>
  ): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required to assign tools.');

      // 1. Fetch current tool status
      const tool = await this.getToolDetail(assignment.tool_id);
      if (tool.status !== 'AVAILABLE') {
        throw new Error(`Tool is not available (Current Status: ${tool.status}).`);
      }

      // Check calibration blocker: past next_calibration_due
      if (tool.requires_calibration && tool.next_calibration_due) {
        const calDue = new Date(tool.next_calibration_due);
        if (calDue < new Date()) {
          throw new Error(`Assignment Blocked: Tool ${tool.tool_number} calibration expired on ${tool.next_calibration_due}. Run calibration service first.`);
        }
      }

      // 2. Insert Tool Assignment
      const { data: newAssign, error: assignErr } = await supabase
        .from('tool_assignments')
        .insert({
          tool_id: assignment.tool_id,
          issued_to: assignment.issued_to,
          issued_by: user.id,
          project_id: assignment.project_id || null,
          expected_return_date: assignment.expected_return_date || null,
          issue_condition: assignment.issue_condition,
          issue_signature_path: assignment.issue_signature_path || null,
          notes: assignment.notes || null
        })
        .select('id')
        .single();

      if (assignErr) throw assignErr;

      // 3. Update Tool Status, Location, and Custodian
      await supabase
        .from('tools')
        .update({
          status: 'ISSUED',
          current_custodian_id: assignment.issued_to,
          current_location_id: null, // location transitions to site/custodian van
          updated_at: new Date().toISOString()
        })
        .eq('id', assignment.tool_id);

      return newAssign.id;
    } catch (err) {
      logger.error('Error assigning tool:', err);
      throw err;
    }
  },

  /**
   * Returns a tool, recording returned date, inspection condition, and checking-in the tool.
   */
  async returnTool(
    assignmentId: string,
    returnCondition: ToolCondition,
    notes?: string
  ): Promise<void> {
    try {
      // 1. Fetch the active assignment
      const { data: assign, error: assignErr } = await supabase
        .from('tool_assignments')
        .select('*')
        .eq('id', assignmentId)
        .single();

      if (assignErr) throw assignErr;
      if (assign.returned_date) throw new Error('Tool assignment is already completed and returned.');

      // 2. Update Assignment check-in details
      await supabase
        .from('tool_assignments')
        .update({
          returned_date: new Date().toISOString(),
          return_condition: returnCondition,
          notes: notes ? `${assign.notes || ''}\nReturn Note: ${notes}`.trim() : assign.notes
        })
        .eq('id', assignmentId);

      // 3. Update Tool: status back to AVAILABLE (or UNDER_MAINTENANCE if broken)
      const nextStatus: ToolStatus = returnCondition === 'NEEDS_REPAIR' ? 'UNDER_MAINTENANCE' : 'AVAILABLE';

      await supabase
        .from('tools')
        .update({
          status: nextStatus,
          condition: returnCondition,
          current_custodian_id: null,
          current_location_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', assign.tool_id);

    } catch (err) {
      logger.error('Error returning tool:', err);
      throw err;
    }
  },

  /**
   * Retrieves maintenance history logs.
   */
  async getMaintenanceLogs(toolId?: string): Promise<ToolMaintenance[]> {
    let query = supabase
      .from('tool_maintenance')
      .select(`
        *,
        tools(tool_number, name),
        documents(title)
      `)
      .order('performed_date', { ascending: false });

    if (toolId) query = query.eq('tool_id', toolId);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(row => ({
      ...row,
      tool_number: row.tools?.tool_number,
      tool_name: row.tools?.name,
      cert_document_name: row.documents?.title
    })) as ToolMaintenance[];
  },

  /**
   * Logs a service repair, calibration or inspection.
   * If calibration log is created, it updates the tools' next due metrics.
   */
  async recordMaintenance(log: Omit<ToolMaintenance, 'id' | 'created_at'>): Promise<string> {
    try {
      // 1. Insert Maintenance entry
      const { data, error } = await supabase
        .from('tool_maintenance')
        .insert({
          tool_id: log.tool_id,
          type: log.type,
          performed_date: log.performed_date,
          vendor: log.vendor,
          cost: log.cost || 0.00,
          certificate_document_id: log.certificate_document_id || null,
          next_due_date: log.next_due_date || null,
          notes: log.notes || null
        })
        .select('id')
        .single();

      if (error) throw error;

      // 2. If it's a CALIBRATION log, update the tool specifications
      if (log.type === 'CALIBRATION') {
        const updates: Partial<Tool> = {
          last_calibration_date: log.performed_date,
          next_calibration_due: log.next_due_date || null,
          calibration_cert_document_id: log.certificate_document_id || null,
          updated_at: new Date().toISOString()
        };

        // If calibration was successful and due date is future, set tool back to AVAILABLE if it was UNDER_CALIBRATION
        const tool = await this.getToolDetail(log.tool_id);
        if (tool.status === 'UNDER_CALIBRATION') {
          updates.status = 'AVAILABLE';
        }

        await supabase
          .from('tools')
          .update(updates)
          .eq('id', log.tool_id);
      } else if (log.type === 'REPAIR') {
        // If repair is completed, check if tool status was UNDER_MAINTENANCE and restore
        const tool = await this.getToolDetail(log.tool_id);
        if (tool.status === 'UNDER_MAINTENANCE') {
          await supabase
            .from('tools')
            .update({
              status: 'AVAILABLE',
              condition: 'GOOD',
              updated_at: new Date().toISOString()
            })
            .eq('id', log.tool_id);
        }
      }

      return data.id;
    } catch (err) {
      logger.error('Error logging tool maintenance:', err);
      throw err;
    }
  }
};

export default toolService;
