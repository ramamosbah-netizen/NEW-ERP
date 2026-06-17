// ============================================================
// JEET ERP — WhatsApp Integration React Hooks
// Handles live message streams, chat list polling, and subscriptions
// ============================================================

import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  whatsappService, 
  type WhatsAppChat, 
  type WhatsAppMessage 
} from '@/services/whatsappService';

export function useWhatsApp(activeChatId: string | null) {
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const activeChatIdRef = useRef<string | null>(activeChatId);

  // Sync ref
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  // Load chat sessions
  const loadChats = useCallback(async () => {
    try {
      setLoadingChats(true);
      const data = await whatsappService.fetchChats();
      setChats(data);
      setError(null);
    } catch (err: any) {
      logger.error('Error in useWhatsApp chats:', err);
      setError(err);
    } finally {
      setLoadingChats(false);
    }
  }, []);

  // Load messages for specific chat
  const loadMessages = useCallback(async (chatId: string) => {
    try {
      setLoadingMessages(true);
      const data = await whatsappService.fetchMessages(chatId);
      setMessages(data);
      setError(null);
    } catch (err: any) {
      logger.error('Error in useWhatsApp messages:', err);
      setError(err);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Load initial chats
  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Load messages whenever active chat changes
  useEffect(() => {
    if (activeChatId) {
      loadMessages(activeChatId);
    } else {
      setMessages([]);
    }
  }, [activeChatId, loadMessages]);

  // Set up Realtime Subscriptions for live chat
  useEffect(() => {
    const channelId = Math.random().toString(36).substring(2, 9);

    // 1. Subscribe to new messages
    const messageSub = supabase
      .channel(`whatsapp-messages-live-${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' },
        async (payload) => {
          const newMsg = payload.new as WhatsAppMessage;
          
          // Fetch document join details if any
          if (newMsg.dms_document_id) {
            const { data: doc } = await supabase
              .from('documents')
              .select('id, title, original_filename, file_ext, storage_path')
              .eq('id', newMsg.dms_document_id)
              .single();
            if (doc) {
              newMsg.document = doc;
            }
          }

          // If the message is for the currently open chat, append it
          if (newMsg.chat_id === activeChatIdRef.current) {
            setMessages((prev) => {
              // Deduplicate
              if (prev.some(m => m.id === newMsg.id || (m.message_id && m.message_id === newMsg.message_id))) {
                return prev;
              }
              return [...prev, newMsg];
            });
          }

          // Trigger chat list reload to update last message and sorting
          loadChats();
        }
      )
      .subscribe();

    // 2. Subscribe to chat session updates (e.g. status changes, assignments)
    const chatSub = supabase
      .channel(`whatsapp-chats-live-${channelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_chats' },
        () => {
          loadChats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageSub);
      supabase.removeChannel(chatSub);
    };
  }, [loadChats]);

  // Manual trigger to send free-form message
  const sendReply = async (text: string) => {
    if (!activeChatId) return null;
    try {
      const sentMsg = await whatsappService.sendManualMessage(activeChatId, text);
      
      // Append message instantly if not already received by realtime channel
      setMessages((prev) => {
        if (prev.some(m => m.id === sentMsg.id)) return prev;
        return [...prev, sentMsg];
      });

      // Update chats list last_message_at locally
      setChats((prevChats) =>
        prevChats
          .map((c) =>
            c.id === activeChatId
              ? { ...c, last_message_at: new Date().toISOString(), status: 'HUMAN_AGENT' as const }
              : c
          )
          .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
      );

      return sentMsg;
    } catch (err: any) {
      logger.error('Failed to send WhatsApp manual message:', err);
      alert(err.message || 'Failed to send message.');
      return null;
    }
  };

  const updateStatus = async (status: 'AUTO_REPLY' | 'HUMAN_AGENT' | 'CLOSED', agentId?: string | null) => {
    if (!activeChatId) return;
    try {
      await whatsappService.updateChatStatus(activeChatId, status, agentId);
      // Update local state
      setChats((prev) =>
        prev.map((c) => (c.id === activeChatId ? { ...c, status, assigned_to: agentId !== undefined ? agentId : c.assigned_to } : c))
      );
    } catch (err) {
      logger.error('Failed to update chat status:', err);
    }
  };

  const linkClient = async (clientId: string | null, contractId: string | null) => {
    if (!activeChatId) return;
    try {
      await whatsappService.linkChatToClient(activeChatId, clientId, contractId);
      loadChats();
    } catch (err) {
      logger.error('Failed to link client:', err);
    }
  };

  return {
    chats,
    messages,
    loadingChats,
    loadingMessages,
    error,
    sendReply,
    updateStatus,
    linkClient,
    refetchChats: loadChats,
    refetchMessages: () => activeChatId && loadMessages(activeChatId)
  };
}
