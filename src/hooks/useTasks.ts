// ============================================================
// Aura ERP — Tasks List & Kanban Board React Hook (React Query)
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { taskService } from '@/services/taskService';
import type { Task, TaskStatus, TaskPriority, TaskOrigin } from '@/types/task.types';

export interface TaskFilters {
  assignee_id?: string;
  project_id?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  origin?: TaskOrigin;
  search?: string;
}

const taskKeys = {
  all: ['tasks'] as const,
  list: (f: TaskFilters) => ['tasks', 'list', f] as const,
};

export function useTasks(filters: TaskFilters = {}) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: taskKeys.list(filters), queryFn: () => taskService.fetchTasks(filters) });
  const invalidate = () => qc.invalidateQueries({ queryKey: taskKeys.all });

  const updateStatus = async (taskId: string, toStatus: TaskStatus, blockedReason?: string) => {
    const payload: Partial<Task> = { status: toStatus };
    payload.blocked_reason = toStatus === 'BLOCKED' ? (blockedReason || 'Unknown blocker') : '';
    await taskService.updateTask(taskId, payload);
    await invalidate();
  };

  const createTask = async (taskData: Partial<Task>) => {
    const newTask = await taskService.createTask(taskData);
    await invalidate();
    return newTask;
  };

  const deleteTask = async (taskId: string) => {
    await taskService.deleteTask(taskId);
    await invalidate();
  };

  return {
    tasks: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    updateStatus,
    createTask,
    deleteTask,
  };
}

export default useTasks;
