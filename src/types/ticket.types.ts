// ============================================================
// JEET ERP — Service Tickets (Call-Outs) Type Definitions
// ============================================================

export type ServiceTicketStatus =
  | 'NEW'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'ON_HOLD_PARTS'
  | 'RESOLVED'
  | 'CLOSED'
  | 'CANCELLED'
  | 'DUPLICATE';

export type TicketIntakeChannel = 'MANUAL' | 'PHONE' | 'EMAIL' | 'WHATSAPP';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';

export type TicketCoverage = 'COVERED' | 'CHARGEABLE' | 'WARRANTY';

export type TicketEventType =
  | 'STATUS_CHANGE'
  | 'COMMENT'
  | 'ASSIGNMENT'
  | 'SLA_WARNING'
  | 'CLIENT_UPDATE_SENT';

export type ServiceTicket = {
  id: string;
  ticket_number: string;
  intake_channel: TicketIntakeChannel;
  client_id?: string;
  contract_id?: string;
  project_id?: string;
  site_address: string;
  system: string;
  equipment_id?: string;
  title: string;
  description: string;
  reported_by_name: string;
  reported_by_phone: string;
  priority: TicketPriority;
  coverage: TicketCoverage;
  
  // SLA Fields
  sla_response_due: string; // Timestamp
  sla_resolution_due: string; // Timestamp
  sla_paused_at?: string | null; // Timestamp
  sla_pause_total_minutes: number;
  response_met?: boolean;
  resolution_met?: boolean;
  
  technician_id?: string;
  status: ServiceTicketStatus;
  resolution_summary?: string;
  parts_used: TicketPartItem[];
  client_signature_path?: string;
  sign_name?: string;
  
  chargeable_quote_id?: string;
  invoice_id?: string;
  source_conversation_id?: string;
  
  created_by: string;
  created_at: string;
  updated_at: string;

  // Joined details (populated by query/service)
  client_name?: string;
  contract_number?: string;
  project_name?: string;
  technician_name?: string;
  equipment_model?: string;
  events?: TicketEvent[];
};

export type TicketPartItem = {
  item_code: string;
  description: string;
  quantity: number;
  unit_price: number;
  chargeable: boolean;
};

export type TicketEvent = {
  id: string;
  ticket_id: string;
  type: TicketEventType;
  body: string;
  user_id?: string;
  created_at: string;

  // Joined data
  user_full_name?: string;
  user_role?: string;
};
