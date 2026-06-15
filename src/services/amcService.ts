// ============================================================
// JEET ERP — AMC Contracts Service
// Handles CRUD, quotation/project conversion, and activation.
// ============================================================

import { supabase } from '@/lib/supabase';
import { amcBillingService } from './amcBillingService';
import { ppmScheduleService } from './ppmScheduleService';
import { eventService } from './eventService';
import { auditService } from './auditService';
import type { AMCContract, AMCEquipment } from '@/types/amc.types';

export const amcService = {
  /**
   * Fetches AMC contracts matching optional filters.
   */
  async fetchAMCContracts(filters: {
    status?: string;
    clientId?: string;
    search?: string;
  } = {}): Promise<AMCContract[]> {
    let query = supabase
      .from('amc_contracts')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.clientId) {
      query = query.eq('client_id', filters.clientId);
    }
    if (filters.search) {
      query = query.or(`contract_number.ilike.%${filters.search}%,client_name.ilike.%${filters.search}%,site_name.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as AMCContract[];
  },

  /**
   * Fetches detailed contract info, including equipment register and billing schedule.
   */
  async fetchAMCContractById(id: string): Promise<AMCContract | null> {
    const { data: contract, error: contractErr } = await supabase
      .from('amc_contracts')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (contractErr) {
      if (contractErr.code === 'PGRST116') return null;
      throw contractErr;
    }

    // Fetch equipment
    const { data: equipment, error: eqErr } = await supabase
      .from('amc_equipment')
      .select('*')
      .eq('contract_id', id);
    if (eqErr) throw eqErr;

    // Fetch billing schedule
    const { data: billing, error: billErr } = await supabase
      .from('amc_billing_schedule')
      .select('*')
      .eq('contract_id', id)
      .order('sequence', { ascending: true });
    if (billErr) throw billErr;

    return {
      ...(contract as AMCContract),
      equipment: (equipment || []) as AMCEquipment[],
      billing_schedule: (billing || []) as any[]
    };
  },

  /**
   * Creates a new AMC contract in DRAFT status.
   */
  async createAMCContract(contractData: Partial<AMCContract>): Promise<AMCContract> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    // Fetch client details if client details are missing
    let clientName = contractData.client_name || '';
    let clientTrn = contractData.client_trn || null;
    let clientAddress = contractData.client_address || null;

    if (contractData.client_id && !clientName) {
      const { data: client } = await supabase
        .from('clients')
        .select('name, trn_number, billing_address')
        .eq('id', contractData.client_id)
        .single();
      if (client) {
        clientName = client.name;
        clientTrn = client.trn_number || null;
        clientAddress = client.billing_address || null;
      }
    }

    const { data, error } = await supabase
      .from('amc_contracts')
      .insert({
        ...contractData,
        client_name: clientName,
        client_trn: clientTrn,
        client_address: clientAddress,
        status: 'DRAFT',
        is_active: true,
        created_by: user.id
      })
      .select()
      .single();

    if (error) throw error;
    return data as AMCContract;
  },

  /**
   * Updates an existing contract record.
   */
  async updateAMCContract(id: string, updates: Partial<AMCContract>): Promise<AMCContract> {
    const { data, error } = await supabase
      .from('amc_contracts')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as AMCContract;
  },

  /**
   * Activates an AMC contract, triggering visits and billing schedule generation.
   */
  async activateAMCContract(id: string): Promise<AMCContract> {
    const contract = await this.fetchAMCContractById(id);
    if (!contract) throw new Error('Contract not found');
    if (contract.status !== 'DRAFT' && contract.status !== 'PENDING_APPROVAL') {
      throw new Error(`Cannot activate contract in status ${contract.status}`);
    }

    // Update status to ACTIVE
    const { data: updatedContract, error: updateErr } = await supabase
      .from('amc_contracts')
      .update({
        status: 'ACTIVE',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    const fullContract = updatedContract as AMCContract;

    // 1. Generate Billing Schedule
    await amcBillingService.generateBillingSchedule(fullContract);

    // 2. Generate PPM scheduled visits
    await ppmScheduleService.generatePPMVisitsForContract(fullContract);

    // 3. Emit amc.activated event
    await eventService.emitEvent(
      'amc.activated',
      'AMC_CONTRACT',
      id,
      fullContract.origin_project_id || undefined,
      {
        contract_number: fullContract.contract_number,
        client_name: fullContract.client_name,
        visits_per_year: fullContract.visits_per_year
      }
    );

    auditService.logEvent({ module: 'AMC', action: 'ACTIVATE', entity_type: 'amc_contract', entity_id: id, summary: `Activated contract ${fullContract.contract_number} (${fullContract.client_name})` });
    return fullContract;
  },

  /**
   * Adds multiple equipment assets to the contract's register.
   */
  async addEquipmentToContract(
    contractId: string,
    equipmentItems: Array<Omit<Partial<AMCEquipment>, 'id' | 'contract_id' | 'created_at'>>
  ): Promise<AMCEquipment[]> {
    const items = equipmentItems.map((item) => ({
      ...item,
      contract_id: contractId
    }));

    const { data, error } = await supabase
      .from('amc_equipment')
      .insert(items)
      .select();

    if (error) throw error;
    return (data || []) as AMCEquipment[];
  },

  /**
   * Converts an accepted AMC quotation into a Draft AMC contract.
   */
  async convertQuotationToAMC(quotationId: string, customStartDate: string): Promise<AMCContract> {
    const { data: quote, error: quoteErr } = await supabase
      .from('quotations')
      .select('*, clients(*)')
      .eq('id', quotationId)
      .single();

    if (quoteErr) throw quoteErr;
    if (quote.status !== 'ACCEPTED_BY_CLIENT') {
      throw new Error('Quotation must be in ACCEPTED_BY_CLIENT status to convert to AMC');
    }

    const start = new Date(customStartDate);
    const end = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate() - 1);
    const endDateStr = end.toISOString().split('T')[0];

    const coverage = quote.amc_coverage || {};

    const contract = await this.createAMCContract({
      client_id: quote.client_id,
      client_name: quote.client_name,
      client_trn: quote.clients?.trn_number || quote.client_trn,
      client_address: quote.clients?.billing_address || quote.client_address,
      site_name: quote.subject || 'Client Site',
      site_address: quote.clients?.billing_address || 'Dubai, UAE',
      emirate: 'DUBAI', // default, user can edit
      origin_project_id: quote.project_id || null,
      origin_quotation_id: quotationId,
      contract_type: coverage.contract_type || 'NON_COMPREHENSIVE',
      systems: quote.systems || [],
      coverage_matrix: coverage.matrix || {},
      parts_included: coverage.parts_included || false,
      parts_cap_aed: coverage.parts_cap_aed || null,
      visits_per_year: coverage.visits_per_year || 4,
      sla_tier: coverage.sla_tier || 'STANDARD',
      response_hours: coverage.response_hours || 24,
      resolution_hours: coverage.resolution_hours || 48,
      emergency_callouts_included: coverage.emergency_callouts_included || null,
      annual_value: quote.subtotal_after_discount || quote.grand_total_with_vat,
      billing_frequency: coverage.billing_frequency || 'QUARTERLY',
      start_date: customStartDate,
      end_date: endDateStr,
      auto_renewal: coverage.auto_renewal || false,
      sira_linked: coverage.sira_linked || false,
      sira_expiry_date: coverage.sira_expiry_date || null
    });

    // Update quotation status to converted/locked
    await supabase
      .from('quotations')
      .update({
        is_locked: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', quotationId);

    return contract;
  },

  /**
   * Converts a project in DLP milestone status to a Draft AMC contract.
   */
  async convertProjectToAMC(projectId: string, customStartDate: string): Promise<AMCContract> {
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('*, clients(*)')
      .eq('id', projectId)
      .single();

    if (projErr) throw projErr;

    const start = new Date(customStartDate);
    const end = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate() - 1);
    const endDateStr = end.toISOString().split('T')[0];

    const contract = await this.createAMCContract({
      client_id: project.client_id,
      client_name: project.client_name,
      client_trn: project.clients?.trn_number || null,
      client_address: project.clients?.billing_address || project.site_address,
      site_name: project.name,
      site_address: project.site_address || 'Dubai, UAE',
      emirate: project.emirate || 'DUBAI',
      origin_project_id: projectId,
      contract_type: 'NON_COMPREHENSIVE',
      systems: project.systems || [],
      visits_per_year: 4,
      sla_tier: 'STANDARD',
      response_hours: 24,
      resolution_hours: 48,
      annual_value: Number((project.contract_value * 0.1).toFixed(2)), // standard 10% estimation
      billing_frequency: 'QUARTERLY',
      start_date: customStartDate,
      end_date: endDateStr,
      auto_renewal: false,
      sira_linked: project.sira_applicable || false
    });

    return contract;
  },

  /**
   * Renews an existing contract, copying assets and linking sequence.
   */
  async renewContract(
    oldContractId: string,
    customStartDate: string,
    newAnnualValue?: number
  ): Promise<AMCContract> {
    const oldContract = await this.fetchAMCContractById(oldContractId);
    if (!oldContract) throw new Error('Contract not found');

    const start = new Date(customStartDate);
    const end = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate() - 1);
    const endDateStr = end.toISOString().split('T')[0];

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    // 1. Create new contract as DRAFT
    const { data: newContract, error: insertErr } = await supabase
      .from('amc_contracts')
      .insert({
        client_id: oldContract.client_id,
        client_name: oldContract.client_name,
        client_trn: oldContract.client_trn,
        client_address: oldContract.client_address,
        site_name: oldContract.site_name,
        site_address: oldContract.site_address,
        emirate: oldContract.emirate,
        origin_project_id: oldContract.origin_project_id,
        contract_type: oldContract.contract_type,
        systems: oldContract.systems,
        coverage_matrix: oldContract.coverage_matrix,
        parts_included: oldContract.parts_included,
        parts_cap_aed: oldContract.parts_cap_aed,
        visits_per_year: oldContract.visits_per_year,
        sla_tier: oldContract.sla_tier,
        response_hours: oldContract.response_hours,
        resolution_hours: oldContract.resolution_hours,
        emergency_callouts_included: oldContract.emergency_callouts_included,
        annual_value: newAnnualValue ?? oldContract.annual_value,
        billing_frequency: oldContract.billing_frequency,
        start_date: customStartDate,
        end_date: endDateStr,
        auto_renewal: oldContract.auto_renewal,
        sira_linked: oldContract.sira_linked,
        status: 'DRAFT',
        renewed_from_id: oldContractId,
        is_active: true,
        created_by: user.id
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // 2. Copy equipment records
    if (oldContract.equipment && oldContract.equipment.length > 0) {
      const newEquipment = oldContract.equipment.map((eq) => ({
        system: eq.system,
        equipment_type: eq.equipment_type,
        brand: eq.brand,
        model: eq.model,
        serial_no: eq.serial_no,
        location_label: eq.location_label,
        install_date: eq.install_date,
        condition: eq.condition,
        notes: eq.notes,
        contract_id: newContract.id
      }));
      await supabase.from('amc_equipment').insert(newEquipment);
    }

    // 3. Set old contract as RENEWED and link it
    await supabase
      .from('amc_contracts')
      .update({
        renewed_to_id: newContract.id,
        status: 'RENEWED',
        updated_at: new Date().toISOString()
      })
      .eq('id', oldContractId);

    auditService.logEvent({ module: 'AMC', action: 'RENEW', entity_type: 'amc_contract', entity_id: newContract.id, summary: `Renewed ${oldContract.contract_number} → ${newContract.contract_number}` });
    return newContract as AMCContract;
  }
};
