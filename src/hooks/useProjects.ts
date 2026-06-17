// ============================================================
// Aura ERP — Project Master React Hooks  (React Query pilot)
// Reference pattern for migrating hand-rolled useState/useEffect data hooks
// to TanStack Query: cached reads + mutations that invalidate the cache.
// Public API is unchanged, so existing call sites keep working.
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projectService } from '@/lib/project-service';
import type {
  Project,
  ProjectFilters,
  ProjectStatus,
  ProjectContact,
  ProjectMilestone,
} from '@/types/project.types';

// Centralised query keys so reads and invalidations stay in sync.
const projectKeys = {
  all: ['projects'] as const,
  lists: ['projects', 'list'] as const,
  list: (filters: ProjectFilters) => ['projects', 'list', filters] as const,
  detail: (id: string) => ['projects', 'detail', id] as const,
};

// 1. Fetch list of projects
export function useProjects(filters: ProjectFilters = {}) {
  const query = useQuery({
    queryKey: projectKeys.list(filters),
    queryFn: () => projectService.fetchProjects(filters),
  });

  return {
    projects: query.data ?? [],
    loading: query.isPending,
    error: (query.error as Error | null) ?? null,
    refetch: query.refetch,
  };
}

// 2. Fetch project details and operations
export function useProject(id: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => projectService.fetchProjectById(id),
    enabled: !!id,
  });

  // Refresh just this project's detail.
  const invalidateDetail = () => qc.invalidateQueries({ queryKey: projectKeys.detail(id) });
  // Refresh this project AND any cached lists (status/value changes show in tables).
  const invalidateAll = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: projectKeys.detail(id) }),
      qc.invalidateQueries({ queryKey: projectKeys.lists }),
    ]);
  };

  const updateProject = async (updates: Partial<Project>) => {
    const success = await projectService.updateProject(id, updates);
    if (success) await invalidateAll();
    return success;
  };

  const transitionStatus = async (toStatus: ProjectStatus, comment?: string) => {
    const success = await projectService.transitionStatus(id, toStatus, comment);
    if (success) await invalidateAll();
    return success;
  };

  const addContact = async (contact: Omit<ProjectContact, 'id' | 'created_at' | 'project_id'>) => {
    const res = await projectService.addContact({ ...contact, project_id: id });
    await invalidateDetail();
    return res;
  };

  const updateContact = async (contactId: string, updates: Partial<ProjectContact>) => {
    const success = await projectService.updateContact(contactId, updates);
    if (success) await invalidateDetail();
    return success;
  };

  const deleteContact = async (contactId: string) => {
    const success = await projectService.deleteContact(contactId);
    if (success) await invalidateDetail();
    return success;
  };

  const addMilestone = async (milestone: Omit<ProjectMilestone, 'id' | 'created_at' | 'project_id'>) => {
    const res = await projectService.addMilestone({ ...milestone, project_id: id });
    await invalidateDetail();
    return res;
  };

  const updateMilestone = async (milestoneId: string, updates: Partial<ProjectMilestone>) => {
    const success = await projectService.updateMilestone(milestoneId, updates);
    if (success) await invalidateDetail();
    return success;
  };

  const deleteMilestone = async (milestoneId: string) => {
    const success = await projectService.deleteMilestone(milestoneId);
    if (success) await invalidateDetail();
    return success;
  };

  const reorderMilestones = async (milestones: { id: string; sort_order: number }[]) => {
    const success = await projectService.reorderMilestones(milestones);
    if (success) await invalidateDetail();
    return success;
  };

  return {
    project: query.data ?? null,
    loading: query.isPending,
    error: (query.error as Error | null) ?? null,
    refetch: query.refetch,
    actions: {
      updateProject,
      transitionStatus,
      addContact,
      updateContact,
      deleteContact,
      addMilestone,
      updateMilestone,
      deleteMilestone,
      reorderMilestones,
    },
  };
}
