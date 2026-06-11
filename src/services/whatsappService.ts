// ============================================================
// JEET ERP — WhatsApp Integration Service
// Client-side functions for managing chats, messages, and settings
// ============================================================

import { supabase } from '@/lib/supabase';

export interface WhatsAppChat {
  id: string;
  phone_number: string;
  client_id: string | null;
  contract_id: string | null;
  status: 'AUTO_REPLY' | 'HUMAN_AGENT' | 'CLOSED';
  assigned_to: string | null;
  last_message_at: string;
  created_at: string;
  
  // Joins
  client?: { name: string } | null;
  contract?: { contract_number: string; site_name: string } | null;
  agent?: { full_name: string } | null;
}

export interface WhatsAppMessage {
  id: string;
  chat_id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  sender_name: string | null;
  message_body: string | null;
  message_type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location';
  media_url: string | null;
  dms_document_id: string | null;
  message_id: string | null;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  metadata: Record<string, any> | null;
  created_at: string;
  
  // Joins
  document?: {
    id: string;
    title: string;
    original_filename: string;
    file_ext: string;
    storage_path: string;
  } | null;
}

export interface WhatsAppSettings {
  id: boolean;
  whatsapp_enabled: boolean;
  phone_number_id: string | null;
  waba_id: string | null;
  access_token: string | null;
  verify_token: string;
  gemini_api_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppTemplate {
  id: string;
  event_type: string;
  template_name: string;
  language_code: string;
  body_template: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
}

export const whatsappService = {
  /**
   * Fetches all active or closed WhatsApp chat sessions
   */
  async fetchChats(): Promise<WhatsAppChat[]> {
    const { data, error } = await supabase
      .from('whatsapp_chats')
      .select(`
        *,
        client:clients(name),
        contract:amc_contracts(contract_number, site_name),
        agent:profiles!assigned_to(full_name)
      `)
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('Error fetching chats:', error);
      throw error;
    }

    return (data || []) as unknown as WhatsAppChat[];
  },

  /**
   * Fetches conversation logs for a specific chat session
   */
  async fetchMessages(chatId: string): Promise<WhatsAppMessage[]> {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select(`
        *,
        document:documents(id, title, original_filename, file_ext, storage_path)
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }

    return (data || []) as unknown as WhatsAppMessage[];
  },

  /**
   * Sends a manual free-form message from an ERP agent
   */
  async sendManualMessage(chatId: string, bodyText: string): Promise<WhatsAppMessage> {
    const { data, error } = await supabase.functions.invoke('send-whatsapp', {
      body: { chat_id: chatId, message_body: bodyText }
    });

    if (error) {
      console.error('Error invoking send-whatsapp for manual reply:', error);
      throw error;
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Failed to send WhatsApp message.');
    }

    return data.message as WhatsAppMessage;
  },

  /**
   * Changes the session status (AUTO_REPLY / HUMAN_AGENT / CLOSED) or assigned agent
   */
  async updateChatStatus(
    chatId: string, 
    status: 'AUTO_REPLY' | 'HUMAN_AGENT' | 'CLOSED',
    assignedTo?: string | null
  ): Promise<boolean> {
    const updatePayload: any = { status };
    if (assignedTo !== undefined) {
      updatePayload.assigned_to = assignedTo;
    }

    const { error } = await supabase
      .from('whatsapp_chats')
      .update(updatePayload)
      .eq('id', chatId);

    if (error) {
      console.error('Error updating chat status:', error);
      throw error;
    }

    return true;
  },

  /**
   * Manually links a chat session to a client and contract
   */
  async linkChatToClient(
    chatId: string, 
    clientId: string | null, 
    contractId: string | null
  ): Promise<boolean> {
    const { error } = await supabase
      .from('whatsapp_chats')
      .update({
        client_id: clientId,
        contract_id: contractId
      })
      .eq('id', chatId);

    if (error) {
      console.error('Error linking chat to client:', error);
      throw error;
    }

    return true;
  },

  /**
   * Fetches global WhatsApp integration configurations
   */
  async fetchSettings(): Promise<WhatsAppSettings> {
    const { data, error } = await supabase
      .from('whatsapp_settings')
      .select('*')
      .single();

    if (error) {
      console.error('Error fetching settings:', error);
      throw error;
    }

    return data as WhatsAppSettings;
  },

  /**
   * Saves settings modifications
   */
  async saveSettings(updates: Partial<WhatsAppSettings>): Promise<boolean> {
    const { error } = await supabase
      .from('whatsapp_settings')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', true);

    if (error) {
      console.error('Error saving WhatsApp settings:', error);
      throw error;
    }

    return true;
  },

  /**
   * Fetches template registries
   */
  async fetchTemplates(): Promise<WhatsAppTemplate[]> {
    const { data, error } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .order('event_type', { ascending: true });

    if (error) {
      console.error('Error fetching templates:', error);
      throw error;
    }

    return data as WhatsAppTemplate[];
  },

  /**
   * Updates a template mapping configuration
   */
  async updateTemplate(templateId: string, updates: Partial<WhatsAppTemplate>): Promise<boolean> {
    const { error } = await supabase
      .from('whatsapp_templates')
      .update(updates)
      .eq('id', templateId);

    if (error) {
      console.error('Error updating template mapping:', error);
      throw error;
    }

    return true;
  }
};
export default whatsappService;
