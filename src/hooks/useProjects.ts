// ============================================================
// JEET ERP — Project Master React Hooks
// Custom hooks for listing projects, details, status transitions, milestones, and contacts
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { projectService } from '@/lib/project-service';
import type { 
  Project, 
  ProjectFilters, 
  ProjectStatus, 
  ProjectContact, 
  ProjectMilestone 
} from '@/types/project.types';

// 1. Fetch list of projects
export function useProjects(filters: ProjectFilters = {}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const data = await projectService.fetchProjects(filters);
      setProjects(data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching projects list:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return { projects, loading, error, refetch: fetchList };
}

// 2. Fetch project details and operations
export function useProject(id: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await projectService.fetchProjectById(id);
      setProject(data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching project detail:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Actions wrapped with state refreshers
  const updateProject = async (updates: Partial<Project>) => {
    const success = await projectService.updateProject(id, updates);
    if (success) await fetchDetail();
    return success;
  };

  const transitionStatus = async (toStatus: ProjectStatus, comment?: string) => {
    const success = await projectService.transitionStatus(id, toStatus, comment);
    if (success) await fetchDetail();
    return success;
  };

  const addContact = async (contact: Omit<ProjectContact, 'id' | 'created_at' | 'project_id'>) => {
    const res = await projectService.addContact({ ...contact, project_id: id });
    await fetchDetail();
    return res;
  };

  const updateContact = async (contactId: string, updates: Partial<ProjectContact>) => {
    const success = await projectService.updateContact(contactId, updates);
    if (success) await fetchDetail();
    return success;
  };

  const deleteContact = async (contactId: string) => {
    const success = await projectService.deleteContact(contactId);
    if (success) await fetchDetail();
    return success;
  };

  const addMilestone = async (milestone: Omit<ProjectMilestone, 'id' | 'created_at' | 'project_id'>) => {
    const res = await projectService.addMilestone({ ...milestone, project_id: id });
    await fetchDetail();
    return res;
  };

  const updateMilestone = async (milestoneId: string, updates: Partial<ProjectMilestone>) => {
    const success = await projectService.updateMilestone(milestoneId, updates);
    if (success) await fetchDetail();
    return success;
  };

  const deleteMilestone = async (milestoneId: string) => {
    const success = await projectService.deleteMilestone(milestoneId);
    if (success) await fetchDetail();
    return success;
  };

  const reorderMilestones = async (milestones: { id: string; sort_order: number }[]) => {
    const success = await projectService.reorderMilestones(milestones);
    if (success) await fetchDetail();
    return success;
  };

  return {
    project,
    loading,
    error,
    refetch: fetchDetail,
    actions: {
      updateProject,
      transitionStatus,
      addContact,
      updateContact,
      deleteContact,
      addMilestone,
      updateMilestone,
      deleteMilestone,
      reorderMilestones
    }
  };
}
