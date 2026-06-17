// ============================================================
// JEET ERP — Service Tickets React Hooks
// ============================================================

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import { ticketService } from '@/services/ticketService';
import type { ServiceTicket, TicketPartItem, TicketEvent } from '@/types/ticket.types';

export interface TicketFilters {
  status?: string;
  technicianId?: string;
  priority?: string;
  search?: string;
}

/**
 * Hook to retrieve and filter the list of service tickets.
 */
export function useTickets(filters: TicketFilters = {}) {
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ticketService.fetchTickets(filters);
      setTickets(data);
      setError(null);
    } catch (err: any) {
      logger.error('Error in useTickets hook:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return { tickets, loading, error, refetch: fetchList };
}

/**
 * Hook to retrieve a single service ticket and execute operational state changes.
 */
export function useTicket(id?: string) {
  const [ticket, setTicket] = useState<ServiceTicket | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState<Error | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await ticketService.fetchTicketById(id);
      setTicket(data);
      setError(null);
    } catch (err: any) {
      logger.error(`Error in useTicket hook for ID ${id}:`, err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const logTicket = async (data: Omit<Partial<ServiceTicket>, 'id' | 'ticket_number' | 'created_at'>): Promise<ServiceTicket> => {
    try {
      setLoading(true);
      const res = await ticketService.createTicket(data);
      setError(null);
      return res;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const assign = async (technicianId: string): Promise<ServiceTicket> => {
    if (!id) throw new Error('Ticket ID is required');
    try {
      setLoading(true);
      const res = await ticketService.assignTicket(id, technicianId);
      await fetchDetail();
      return res;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const dispatch = async (): Promise<ServiceTicket> => {
    if (!id) throw new Error('Ticket ID is required');
    try {
      setLoading(true);
      const res = await ticketService.dispatchTechnician(id);
      await fetchDetail();
      return res;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const pauseForParts = async (reason: string): Promise<ServiceTicket> => {
    if (!id) throw new Error('Ticket ID is required');
    try {
      setLoading(true);
      const res = await ticketService.pauseTicketForParts(id, reason);
      await fetchDetail();
      return res;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resume = async (): Promise<ServiceTicket> => {
    if (!id) throw new Error('Ticket ID is required');
    try {
      setLoading(true);
      const res = await ticketService.resumeTicketFromHold(id);
      await fetchDetail();
      return res;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resolve = async (
    resolutionSummary: string,
    partsUsed: TicketPartItem[],
    clientSignName?: string
  ): Promise<ServiceTicket> => {
    if (!id) throw new Error('Ticket ID is required');
    try {
      setLoading(true);
      const res = await ticketService.resolveTicket(id, resolutionSummary, partsUsed, clientSignName);
      await fetchDetail();
      return res;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const close = async (): Promise<ServiceTicket> => {
    if (!id) throw new Error('Ticket ID is required');
    try {
      setLoading(true);
      const res = await ticketService.closeTicket(id);
      await fetchDetail();
      return res;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const addComment = async (commentText: string): Promise<TicketEvent> => {
    if (!id) throw new Error('Ticket ID is required');
    try {
      const comment = await ticketService.addTicketComment(id, commentText);
      await fetchDetail();
      return comment;
    } catch (err: any) {
      setError(err);
      throw err;
    }
  };

  return {
    ticket,
    loading,
    error,
    refetch: fetchDetail,
    createTicket: logTicket,
    assignTicket: assign,
    dispatchTicket: dispatch,
    pauseTicketForParts: pauseForParts,
    resumeTicket: resume,
    resolveTicket: resolve,
    closeTicket: close,
    addComment
  };
}
export default useTickets;
