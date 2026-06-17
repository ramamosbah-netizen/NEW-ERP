// ============================================================
// Aura ERP — Employee Master React Hooks (React Query)
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { employeeService } from '@/services/employeeService';
import type { Employee } from '@/types/hr.types';

const empKeys = {
  lists: ['employees', 'list'] as const,
  list: (f: unknown) => ['employees', 'list', f] as const,
  detail: (id: string) => ['employees', 'detail', id] as const,
};

export function useEmployees(filters?: { department?: string; status?: string }) {
  const q = useQuery({
    queryKey: empKeys.list(filters ?? {}),
    queryFn: () => employeeService.getEmployees(filters),
  });
  return {
    employees: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
  };
}

export function useEmployee(employeeId?: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: empKeys.detail(employeeId ?? ''),
    enabled: !!employeeId,
    queryFn: async () => {
      const [employee, compensations, certifications, documents] = await Promise.all([
        employeeService.getEmployeeById(employeeId!),
        employeeService.getCompensationHistory(employeeId!).catch(() => []), // RLS grace
        employeeService.getCertifications(employeeId!),
        employeeService.getLinkedDocuments(employeeId!),
      ]);
      return { employee, compensations, certifications, documents };
    },
  });

  const inv = () => qc.invalidateQueries({ queryKey: empKeys.detail(employeeId ?? '') });

  const addCompensation = async (params: any) => {
    if (!employeeId) return;
    const res = await employeeService.addCompensation({ ...params, employee_id: employeeId });
    await inv();
    return res;
  };
  const addCertification = async (params: any) => {
    if (!employeeId) return;
    const res = await employeeService.addCertification({ ...params, employee_id: employeeId });
    await inv();
    return res;
  };
  const deleteCertification = async (certId: string) => { await employeeService.deleteCertification(certId); await inv(); };
  const linkDocument = async (documentId: string, documentType: string) => {
    if (!employeeId) return;
    const res = await employeeService.linkDocument({ employee_id: employeeId, document_id: documentId, document_type: documentType });
    await inv();
    return res;
  };
  const unlinkDocument = async (linkId: string) => { await employeeService.unlinkDocument(linkId); await inv(); };
  const updateProfile = async (updates: Partial<Employee>) => {
    if (!employeeId) return;
    const res = await employeeService.updateEmployee(employeeId, updates);
    await inv();
    return res;
  };

  return {
    employee: q.data?.employee ?? null,
    compensations: q.data?.compensations ?? [],
    certifications: q.data?.certifications ?? [],
    documents: q.data?.documents ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    addCompensation,
    addCertification,
    deleteCertification,
    linkDocument,
    unlinkDocument,
    updateProfile,
  };
}

export default useEmployees;
