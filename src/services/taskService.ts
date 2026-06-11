// ============================================================
// JEET ERP — Task Management Service Client
// Handles task CRUD, comment additions, and workload analytics
// ============================================================

import { supabase } from '@/lib/supabase';
import type { Task, TaskStatus, TaskPriority, TaskOrigin, TaskComment } from '@/types/task.types';

export const taskService = {
  /**
   * Fetches tasks matching filter parameters.
   */
  async fetchTasks(filters: {
    assignee_id?: string;
    project_id?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    origin?: TaskOrigin;
    search?: string;
  } = {}): Promise<Task[]> {
    let query = supabase
      .from('tasks')
      .select(`
        *,
        project:projects (name),
        assignee:profiles!tasks_assignee_id_fkey(full_name),
        creator:profiles!tasks_created_by_fkey(full_name)
      `)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (filters.assignee_id) query = query.eq('assignee_id', filters.assignee_id);
    if (filters.project_id) query = query.eq('project_id', filters.project_id);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.priority) query = query.eq('priority', filters.priority);
    if (filters.origin) query = query.eq('origin', filters.origin);

    if (filters.search) {
      query = query.ilike('title', `%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((t: any) => ({
      ...t,
      project_name: t.project?.name,
      assignee_name: t.assignee?.full_name,
      creator_name: t.creator?.full_name
    })) as Task[];
  },

  /**
   * Fetches details of a single task including comments.
   */
  async fetchTaskById(id: string): Promise<Task | null> {
    const { data: task, error } = await supabase
      .from('tasks')
      .select(`
        *,
        project:projects (name),
        assignee:profiles!tasks_assignee_id_fkey(full_name),
        creator:profiles!tasks_created_by_fkey(full_name)
      `)
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    // Fetch comments
    const comments = await this.fetchComments(id);

    return {
      ...task,
      project_name: task.project?.name,
      assignee_name: task.assignee?.full_name,
      creator_name: task.creator?.full_name,
      comments
    } as Task;
  },

  /**
   * Creates a new task.
   */
  async createTask(taskData: Partial<Task>): Promise<Task> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required.');

    const insertData = {
      ...taskData,
      created_by: user.id,
      status: taskData.status || 'TODO',
      priority: taskData.priority || 'MEDIUM',
      origin: taskData.origin || 'MANUAL',
      is_active: true
    };

    const { data, error } = await supabase
      .from('tasks')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    return data as Task;
  },

  /**
   * Updates an existing task.
   */
  async updateTask(id: string, updates: Partial<Task>): Promise<boolean> {
    const cleanUpdates = { ...updates };
    delete cleanUpdates.assignee_name;
    delete cleanUpdates.creator_name;
    delete cleanUpdates.project_name;
    delete cleanUpdates.comments;

    if (updates.status === 'DONE' || updates.status === 'DONE_AUTO') {
      cleanUpdates.completed_at = new Date().toISOString();
    }

    cleanUpdates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('tasks')
      .update(cleanUpdates)
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  /**
   * Soft-deletes a task.
   */
  async deleteTask(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('tasks')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  /**
   * Fetches comments for a task.
   */
  async fetchComments(taskId: string): Promise<TaskComment[]> {
    const { data, error } = await supabase
      .from('task_comments')
      .select(`
        *,
        user:profiles (full_name)
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map((c: any) => ({
      ...c,
      user_name: c.user?.full_name
    })) as TaskComment[];
  },

  /**
   * Adds a new comment to a task.
   */
  async addComment(taskId: string, body: string): Promise<TaskComment> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Authentication required.');

    const { data, error } = await supabase
      .from('task_comments')
      .insert({
        task_id: taskId,
        user_id: user.id,
        body
      })
      .select()
      .single();

    if (error) throw error;

    // Fetch full name for response
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    return {
      ...data,
      user_name: profile?.full_name || 'System User'
    } as TaskComment;
  },

  /**
   * Gathers workload statistics across all users.
   */
  async fetchWorkloadAnalytics(): Promise<Array<{
    user_id: string;
    full_name: string;
    role: string;
    todo_count: number;
    in_progress_count: number;
    blocked_count: number;
    overdue_count: number;
  }>> {
    // 1. Get all active profile details
    const { data: profiles, error: profError } = await supabase
      .from('profiles')
      .select('id, full_name, role');

    if (profError) throw profError;

    // 2. Fetch all active open tasks
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('assignee_id, status, due_date')
      .eq('is_active', true)
      .in('status', ['TODO', 'IN_PROGRESS', 'BLOCKED']);

    if (tasksError) throw tasksError;

    const today = new Date();

    return (profiles || []).map(p => {
      const userTasks = (tasks || []).filter(t => t.assignee_id === p.id);

      const todo = userTasks.filter(t => t.status === 'TODO').length;
      const inProgress = userTasks.filter(t => t.status === 'IN_PROGRESS').length;
      const blocked = userTasks.filter(t => t.status === 'BLOCKED').length;

      const overdue = userTasks.filter(t => {
        if (!t.due_date) return false;
        return new Date(t.due_date) < today;
      }).length;

      return {
        user_id: p.id,
        full_name: p.full_name,
        role: p.role,
        todo_count: todo,
        in_progress_count: inProgress,
        blocked_count: blocked,
        overdue_count: overdue
      };
    });
  },

  /**
   * Parses a natural language task description using Gemini 2.0 Flash.
   */
  async parseNaturalLanguageTask(promptText: string): Promise<{
    title: string;
    description?: string;
    priority: TaskPriority;
    due_date?: string;
    suggested_project_name?: string;
    suggested_assignee_name?: string;
  }> {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

    if (!apiKey) {
      console.warn('Gemini API key is not configured. Falling back to regex parser.');
      // Fallback simple parsing
      const isUrgent = /urgent|critical/i.test(promptText);
      const isHigh = /high/i.test(promptText);
      return {
        title: promptText,
        priority: isUrgent ? 'URGENT' : isHigh ? 'HIGH' : 'MEDIUM'
      };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const systemPrompt = `You are a scheduling AI inside JEET ERP. Read the user's natural language command and parse it into a structured task.
Return a JSON object matching this structure:
{
  "title": "Clear concise task title",
  "description": "Any additional descriptive details, checklist items or context, or null",
  "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT",
  "due_date": "YYYY-MM-DD format (estimate based on current date, today is ${todayStr}. If tomorrow is specified, set to tomorrow. If next Sunday, calculate the date, etc.), or null",
  "suggested_project_name": "Name of any mentioned project, or null",
  "suggested_assignee_name": "Full name of any mentioned assignee, or null"
}
Output raw JSON only. Do not format or add markdown block markers.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: systemPrompt },
              { text: `Parse this command: "${promptText}"` }
            ]
          }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini parser failed: HTTP status ${response.status}`);
    }

    const result = await response.json();
    const parsedText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!parsedText) throw new Error('Empty response from Gemini.');

    return JSON.parse(parsedText.trim());
  }
};
export default taskService;