// ============================================================
// Aura ERP — Service Tickets React Hooks (React Query)
// ============================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ticketService } from '@/services/ticketService';
import type { ServiceTicket, TicketPartItem, TicketEvent } from '@/types/ticket.types';

export interface TicketFilters {
  status?: string;
  technicianId?: string;
  priority?: string;
  search?: string;
}

const tKeys = {
  lists: ['tickets', 'list'] as const,
  list: (f: TicketFilters) => ['tickets', 'list', f] as const,
  detail: (id: string) => ['tickets', 'detail', id] as const,
};

export function useTickets(filters: TicketFilters = {}) {
  const q = useQuery({ queryKey: tKeys.list(filters), queryFn: () => ticketService.fetchTickets(filters) });
  return {
    tickets: q.data ?? [],
    loading: q.isPending,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
  };
}

export function useTicket(id?: string) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: tKeys.detail(id ?? ''), queryFn: () => ticketService.fetchTicketById(id!), enabled: !!id });

  const inv = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: tKeys.detail(id ?? '') }),
      qc.invalidateQueries({ queryKey: tKeys.lists }),
    ]);
  };

  const createTicket = async (data: Omit<Partial<ServiceTicket>, 'id' | 'ticket_number' | 'created_at'>): Promise<ServiceTicket> => {
    const res = await ticketService.createTicket(data);
    await qc.invalidateQueries({ queryKey: tKeys.lists });
    return res;
  };
  const assignTicket = async (technicianId: string): Promise<ServiceTicket> => {
    if (!id) throw new Error('Ticket ID is required');
    const res = await ticketService.assignTicket(id, technicianId); await inv(); return res;
  };
  const dispatchTicket = async (): Promise<ServiceTicket> => {
    if (!id) throw new Error('Ticket ID is required');
    const res = await ticketService.dispatchTechnician(id); await inv(); return res;
  };
  const pauseTicketForParts = async (reason: string): Promise<ServiceTicket> => {
    if (!id) throw new Error('Ticket ID is required');
    const res = await ticketService.pauseTicketForParts(id, reason); await inv(); return res;
  };
  const resumeTicket = async (): Promise<ServiceTicket> => {
    if (!id) throw new Error('Ticket ID is required');
    const res = await ticketService.resumeTicketFromHold(id); await inv(); return res;
  };
  const resolveTicket = async (resolutionSummary: string, partsUsed: TicketPartItem[], clientSignName?: string): Promise<ServiceTicket> => {
    if (!id) throw new Error('Ticket ID is required');
    const res = await ticketService.resolveTicket(id, resolutionSummary, partsUsed, clientSignName); await inv(); return res;
  };
  const closeTicket = async (): Promise<ServiceTicket> => {
    if (!id) throw new Error('Ticket ID is required');
    const res = await ticketService.closeTicket(id); await inv(); return res;
  };
  const addComment = async (commentText: string): Promise<TicketEvent> => {
    if (!id) throw new Error('Ticket ID is required');
    const comment = await ticketService.addTicketComment(id, commentText);
    await qc.invalidateQueries({ queryKey: tKeys.detail(id) });
    return comment;
  };

  return {
    ticket: q.data ?? null,
    loading: q.isLoading,
    error: (q.error as Error | null) ?? null,
    refetch: q.refetch,
    createTicket,
    assignTicket,
    dispatchTicket,
    pauseTicketForParts,
    resumeTicket,
    resolveTicket,
    closeTicket,
    addComment,
  };
}

export default useTickets;
