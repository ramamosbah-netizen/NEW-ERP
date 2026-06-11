// ============================================================
// JEET ERP — Employee Master React Hook
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { employeeService } from '@/services/employeeService';
import type { Employee, EmployeeCompensation, EmployeeCertification } from '@/types/hr.types';

export function useEmployees(filters?: { department?: string; status?: string }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await employeeService.getEmployees(filters);
      setEmployees(data);
    } catch (err: any) {
      console.error('Failed to load employees:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [filters?.department, filters?.status]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  return {
    employees,
    loading,
    error,
    refetch: fetchEmployees
  };
}

export function useEmployee(employeeId?: string) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [compensations, setCompensations] = useState<EmployeeCompensation[]>([]);
  const [certifications, setCertifications] = useState<EmployeeCertification[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      setError(null);
      
      const [empData, compData, certData, docData] = await Promise.all([
        employeeService.getEmployeeById(employeeId),
        employeeService.getCompensationHistory(employeeId).catch(() => []), // RLS grace if PM
        employeeService.getCertifications(employeeId),
        employeeService.getLinkedDocuments(employeeId)
      ]);

      setEmployee(empData);
      setCompensations(compData);
      setCertifications(certData);
      setDocuments(docData);
    } catch (err: any) {
      console.error(`Failed to load employee details for ${employeeId}:`, err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const addComp = async (params: any) => {
    if (!employeeId) return;
    const res = await employeeService.addCompensation({ ...params, employee_id: employeeId });
    await fetchDetails();
    return res;
  };

  const addCert = async (params: any) => {
    if (!employeeId) return;
    const res = await employeeService.addCertification({ ...params, employee_id: employeeId });
    await fetchDetails();
    return res;
  };

  const deleteCert = async (certId: string) => {
    await employeeService.deleteCertification(certId);
    await fetchDetails();
  };

  const linkDoc = async (documentId: string, documentType: string) => {
    if (!employeeId) return;
    const res = await employeeService.linkDocument({
      employee_id: employeeId,
      document_id: documentId,
      document_type: documentType
    });
    await fetchDetails();
    return res;
  };

  const unlinkDoc = async (linkId: string) => {
    await employeeService.unlinkDocument(linkId);
    await fetchDetails();
  };

  const updateProfile = async (updates: Partial<Employee>) => {
    if (!employeeId) return;
    const res = await employeeService.updateEmployee(employeeId, updates);
    setEmployee(res);
    return res;
  };

  return {
    employee,
    compensations,
    certifications,
    documents,
    loading,
    error,
    refetch: fetchDetails,
    addCompensation: addComp,
    addCertification: addCert,
    deleteCertification: deleteCert,
    linkDocument: linkDoc,
    unlinkDocument: unlinkDoc,
    updateProfile
  };
}
export default useEmployees;
