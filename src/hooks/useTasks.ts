// ============================================================
// JEET ERP — Tasks List & Kanban Board React Hook
// Handles task CRUD updates, filtering, and state transitions
// ============================================================

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import { taskService } from '@/services/taskService';
import type { Task, TaskStatus, TaskPriority, TaskOrigin } from '@/types/task.types';

export function useTasks(filters: {
  assignee_id?: string;
  project_id?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  origin?: TaskOrigin;
  search?: string;
} = {}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const data = await taskService.fetchTasks(filters);
      setTasks(data);
      setError(null);
    } catch (err: any) {
      logger.error('Failed to load tasks list:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const updateStatus = async (taskId: string, toStatus: TaskStatus, blockedReason?: string) => {
    try {
      const payload: Partial<Task> = { status: toStatus };
      if (toStatus === 'BLOCKED') {
        payload.blocked_reason = blockedReason || 'Unknown blocker';
      } else {
        payload.blocked_reason = '';
      }

      await taskService.updateTask(taskId, payload);
      
      // Local state update for instant UI feedback
      setTasks(prev =>
        prev.map(t => t.id === taskId ? { 
          ...t, 
          status: toStatus, 
          blocked_reason: payload.blocked_reason, 
          completed_at: ['DONE', 'DONE_AUTO'].includes(toStatus) ? new Date().toISOString() : undefined 
        } : t)
      );
    } catch (err) {
      logger.error('Failed to update task status:', err);
      throw err;
    }
  };

  const createTask = async (taskData: Partial<Task>) => {
    const newTask = await taskService.createTask(taskData);
    setTasks(prev => [newTask, ...prev]);
    return newTask;
  };

  const deleteTask = async (taskId: string) => {
    await taskService.deleteTask(taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  return {
    tasks,
    loading,
    error,
    refetch: fetchList,
    updateStatus,
    createTask,
    deleteTask
  };
}
export default useTasks;
