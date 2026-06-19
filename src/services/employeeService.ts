// ============================================================
// JEET ERP — Employee Master Service
// ============================================================

import { supabase } from '@/lib/supabase';
import type { Employee, EmployeeCompensation, EmployeeCertification, EmployeeDocument } from '@/types/hr.types';

export const employeeService = {
  /**
   * Retrieves all employees with filters.
   */
  async getEmployees(filters?: { department?: string; status?: string; companyId?: string }): Promise<Employee[]> {
    let query = supabase
      .from('employees')
      .select('*')
      .eq('is_active', true)
      .order('employee_number', { ascending: true });

    // Multi-company scope (wave 2): active company's employees + untagged rows.
    if (filters?.companyId) {
      query = query.or(`company_id.eq.${filters.companyId},company_id.is.null`);
    }
    if (filters?.department) {
      query = query.eq('department', filters.department);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Employee[];
  },

  /**
   * Retrieves a single employee by ID.
   */
  async getEmployeeById(employeeId: string): Promise<Employee> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .single();

    if (error) throw error;
    return data as Employee;
  },

  /**
   * Creates a new employee master record.
   */
  async createEmployee(params: Omit<Employee, 'id' | 'employee_number' | 'current_hourly_cost_rate' | 'created_at' | 'updated_at' | 'is_active'>): Promise<Employee> {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('employees')
      .insert({
        ...params,
        created_by: user?.id || null,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return data as Employee;
  },

  /**
   * Updates an employee master record.
   */
  async updateEmployee(employeeId: string, updates: Partial<Employee>): Promise<Employee> {
    const { data, error } = await supabase
      .from('employees')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', employeeId)
      .select()
      .single();

    if (error) throw error;
    return data as Employee;
  },

  /**
   * Soft deletes an employee (sets is_active to false).
   */
  async deleteEmployee(employeeId: string): Promise<void> {
    const { error } = await supabase
      .from('employees')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', employeeId);

    if (error) throw error;
  },

  // ============================================================
  // COMPENSATION HISTORY (RLS-Guarded)
  // ============================================================

  async getCompensationHistory(employeeId: string): Promise<EmployeeCompensation[]> {
    const { data, error } = await supabase
      .from('employee_compensation')
      .select('*')
      .eq('employee_id', employeeId)
      .order('effective_from', { ascending: false });

    if (error) throw error;
    return data as EmployeeCompensation[];
  },

  async addCompensation(params: {
    employee_id: string;
    effective_from: string;
    basic_salary: number;
    housing_allowance: number;
    transport_allowance: number;
    other_allowance: number;
    burden_multiplier?: number;
    notes?: string;
  }): Promise<EmployeeCompensation> {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('employee_compensation')
      .insert({
        ...params,
        created_by: user?.id || null
      })
      .select()
      .single();

    if (error) throw error;
    return data as EmployeeCompensation;
  },

  // ============================================================
  // CERTIFICATIONS
  // ============================================================

  async getCertifications(employeeId: string): Promise<EmployeeCertification[]> {
    const { data, error } = await supabase
      .from('employee_certifications')
      .select('*')
      .eq('employee_id', employeeId)
      .order('expiry_date', { ascending: true });

    if (error) throw error;
    return data as EmployeeCertification[];
  },

  async addCertification(params: Omit<EmployeeCertification, 'id' | 'created_at' | 'updated_at'>): Promise<EmployeeCertification> {
    const { data, error } = await supabase
      .from('employee_certifications')
      .insert(params)
      .select()
      .single();

    if (error) throw error;
    return data as EmployeeCertification;
  },

  async updateCertification(certId: string, updates: Partial<EmployeeCertification>): Promise<EmployeeCertification> {
    const { data, error } = await supabase
      .from('employee_certifications')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', certId)
      .select()
      .single();

    if (error) throw error;
    return data as EmployeeCertification;
  },

  async deleteCertification(certId: string): Promise<void> {
    const { error } = await supabase
      .from('employee_certifications')
      .delete()
      .eq('id', certId);

    if (error) throw error;
  },

  // ============================================================
  // DMS DOCUMENT COHESION
  // ============================================================

  async getLinkedDocuments(employeeId: string): Promise<(EmployeeDocument & { document?: any })[]> {
    const { data, error } = await supabase
      .from('employee_documents')
      .select(`
        *,
        document:documents(*)
      `)
      .eq('employee_id', employeeId);

    if (error) throw error;
    return data as any[];
  },

  async linkDocument(params: {
    employee_id: string;
    document_id: string;
    document_type: string;
  }): Promise<EmployeeDocument> {
    const { data, error } = await supabase
      .from('employee_documents')
      .insert({
        employee_id: params.employee_id,
        document_id: params.document_id,
        document_type: params.document_type
      })
      .select()
      .single();

    if (error) throw error;
    return data as EmployeeDocument;
  },

  async unlinkDocument(employeeDocId: string): Promise<void> {
    const { error } = await supabase
      .from('employee_documents')
      .delete()
      .eq('id', employeeDocId);

    if (error) throw error;
  }
};

export default employeeService;
