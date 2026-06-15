// ============================================================
// JEET ERP — Handover / Closeout Service
// ============================================================

import { supabase } from '@/lib/supabase';
import { HandoverPackage, HandoverChecklistItem, HandoverGateStatus } from '@/types/handover.types';
import { HANDOVER_CHECKLIST_SEED } from '@/constants/handoverChecklistSeed';
import { eventService } from './eventService';

export const handoverService = {
  /**
   * Retrieves the handover package and checklist for a project.
   */
  async getHandoverPackage(projectId: string): Promise<HandoverPackage | null> {
    // NOTE: PostgREST embeds are unreliable in this setup (handover_packages has
    // no FK to profiles → PGRST200). Use separate keyed lookups instead.
    const { data: pkg, error: pkgErr } = await supabase
      .from('handover_packages')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (pkgErr) {
      if (pkgErr.code === 'PGRST116') return null; // not found
      throw pkgErr;
    }

    const { data: items, error: itemsErr } = await supabase
      .from('handover_checklist_items')
      .select('*')
      .eq('package_id', pkg.id)
      .order('sort', { ascending: true });

    if (itemsErr) throw itemsErr;

    // ---- separate lookups (replace embeds) ----
    // project
    let projectName: string | undefined, projectNumber: string | undefined;
    if (pkg.project_id) {
      const { data: proj } = await supabase
        .from('projects').select('name, project_number').eq('id', pkg.project_id).maybeSingle();
      projectName = proj?.name;
      projectNumber = proj?.project_number;
    }

    // profiles (package creator + any waived_by), batched
    const profileIds = [pkg.created_by, ...(items || []).map((i: any) => i.waived_by)].filter(Boolean) as string[];
    const profileMap = new Map<string, string>();
    if (profileIds.length) {
      const { data: profs } = await supabase
        .from('profiles').select('id, full_name').in('id', [...new Set(profileIds)]);
      (profs || []).forEach((p: any) => profileMap.set(p.id, p.full_name));
    }

    // evidence documents, batched
    const docIds = (items || []).map((i: any) => i.evidence_document_id).filter(Boolean) as string[];
    const docMap = new Map<string, string>();
    if (docIds.length) {
      const { data: docs } = await supabase
        .from('documents').select('id, title').in('id', [...new Set(docIds)]);
      (docs || []).forEach((d: any) => docMap.set(d.id, d.title));
    }

    const checklistItems = (items || []).map((item: any) => ({
      ...item,
      waived_by_name: item.waived_by ? profileMap.get(item.waived_by) : undefined,
      evidence_document_name: item.evidence_document_id ? docMap.get(item.evidence_document_id) : undefined
    })) as HandoverChecklistItem[];

    return {
      ...pkg,
      project_name: projectName,
      project_number: projectNumber,
      created_by_name: pkg.created_by ? profileMap.get(pkg.created_by) : undefined,
      checklist_items: checklistItems
    } as HandoverPackage;
  },

  /**
   * Initializes a handover package and inserts the default checklist requirements.
   */
  async initializeHandoverPackage(projectId: string): Promise<HandoverPackage> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    // Check if package already exists
    const existing = await this.getHandoverPackage(projectId);
    if (existing) return existing;

    // Fetch project to verify existence
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('name, project_number')
      .eq('id', projectId)
      .single();

    if (projErr) throw projErr;

    // 1. Create Handover Package
    const { data: pkg, error: pkgErr } = await supabase
      .from('handover_packages')
      .insert({
        project_id: projectId,
        status: 'IN_PREPARATION',
        dlp_start_confirmed: false,
        created_by: user.id
      })
      .select()
      .single();

    if (pkgErr) throw pkgErr;

    // 2. Insert default checklist items
    const checklistInserts = HANDOVER_CHECKLIST_SEED.map(item => ({
      package_id: pkg.id,
      category: item.category,
      requirement: item.requirement,
      mandatory: item.mandatory,
      status: 'PENDING',
      sort: item.sort
    }));

    const { error: itemsErr } = await supabase
      .from('handover_checklist_items')
      .insert(checklistInserts);

    if (itemsErr) throw itemsErr;

    return (await this.getHandoverPackage(projectId))!;
  },

  /**
   * Validates project readiness for handover by inspecting all gates.
   */
  async checkGateStatus(projectId: string): Promise<HandoverGateStatus> {
    const blockers: string[] = [];

    // 1. Get Project
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('status, name, contract_value, retention_pct')
      .eq('id', projectId)
      .single();

    if (projErr) throw projErr;

    // 2. T&C Packages Gate
    const { data: tcPackages, error: tcErr } = await supabase
      .from('tc_packages')
      .select('package_number, status')
      .eq('project_id', projectId)
      .eq('is_active', true);

    if (tcErr) throw tcErr;

    const tcTotal = tcPackages?.length || 0;
    const tcCompletedCount = tcPackages?.filter(p => p.status === 'COMPLETED').length || 0;
    const tcCompleted = tcTotal > 0 && tcCompletedCount === tcTotal;

    if (tcTotal === 0) {
      blockers.push('No Testing & Commissioning packages have been defined for the project.');
    } else if (tcCompletedCount < tcTotal) {
      blockers.push(`${tcTotal - tcCompletedCount} of ${tcTotal} T&C packages are pending completion.`);
    }

    // 3. Snag List Gate
    // 0 CRITICAL open snags (can never be deferred)
    // 0 MAJOR open snags (majors can be deferred to DLP with justification)
    const { data: snags, error: snagErr } = await supabase
      .from('snags')
      .select('snag_number, severity, status')
      .eq('project_id', projectId);

    if (snagErr) throw snagErr;

    const openCritical = snags?.filter(s => s.severity === 'CRITICAL' && s.status !== 'CLOSED').length || 0;
    const openMajor = snags?.filter(s => s.severity === 'MAJOR' && s.status !== 'CLOSED' && s.status !== 'DEFERRED_TO_DLP').length || 0;
    const openMinor = snags?.filter(s => s.severity === 'MINOR' && s.status !== 'CLOSED' && s.status !== 'DEFERRED_TO_DLP').length || 0;

    const snagsClear = openCritical === 0 && openMajor === 0;

    if (openCritical > 0) {
      blockers.push(`There are ${openCritical} critical open snags. Critical defects must be resolved before closeout.`);
    }
    if (openMajor > 0) {
      blockers.push(`There are ${openMajor} major open snags that are not resolved or deferred to DLP.`);
    }

    // 4. Handover Checklist / DMS files Gate
    const pkg = await this.getHandoverPackage(projectId);
    let dmsFilesUploaded = true;
    const missingCategories: string[] = [];

    if (!pkg) {
      blockers.push('Handover closeout checklist has not been initialized.');
      dmsFilesUploaded = false;
    } else {
      const items = pkg.checklist_items || [];
      for (const item of items) {
        if (item.mandatory && item.status === 'PENDING') {
          dmsFilesUploaded = false;
          if (!missingCategories.includes(item.category)) {
            missingCategories.push(item.category);
          }
        }
      }
      
      if (missingCategories.length > 0) {
        blockers.push(`Mandatory closeout items are pending in categories: ${missingCategories.join(', ')}.`);
      }
    }

    // 5. Retention verification
    // We check if retention pct is set on project
    const retentionReleaseCalculated = project.retention_pct !== null && project.retention_pct > 0;

    const canHandover = blockers.length === 0;

    return {
      can_handover: canHandover,
      blockers,
      tc_completed: tcCompleted,
      tc_total: tcTotal,
      tc_completed_count: tcCompletedCount,
      snags_clear: snagsClear,
      open_critical_snags: openCritical,
      open_major_snags: openMajor,
      open_minor_snags: openMinor,
      dms_files_uploaded: dmsFilesUploaded,
      missing_categories: missingCategories,
      retention_release_calculated: retentionReleaseCalculated
    };
  },

  /**
   * Updates the status of a checklist item.
   */
  async updateChecklistItemStatus(
    itemId: string,
    status: 'PENDING' | 'DONE' | 'WAIVED',
    params: {
      evidence_document_id?: string;
      waived_reason?: string;
    } = {}
  ): Promise<HandoverChecklistItem> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const updates: any = {
      status,
      evidence_document_id: params.evidence_document_id || null,
      waived_reason: status === 'WAIVED' ? params.waived_reason || null : null,
      waived_by: status === 'WAIVED' ? user.id : null
    };

    const { data, error } = await supabase
      .from('handover_checklist_items')
      .update(updates)
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;

    return data as HandoverChecklistItem;
  },

  /**
   * Submits handover sign-off, updates project status, generates retention release invoices, and AMC opportunities.
   */
  async submitHandoverSignOff(
    projectId: string,
    params: {
      client_signatory_name: string;
      client_signatory_designation: string;
      signature_base64: string; // signature canvas png
    }
  ): Promise<HandoverPackage> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    // 1. Validate Gates
    const gates = await this.checkGateStatus(projectId);
    if (!gates.can_handover) {
      throw new Error(`Handover validation failed. Blocker reasons: ${gates.blockers.join(' | ')}`);
    }

    const pkg = await this.getHandoverPackage(projectId);
    if (!pkg) throw new Error('Handover checklist package not initialized');
    if (pkg.status === 'COMPLETED' || pkg.status === 'SIGNED') {
      throw new Error('Project handover closeout is already signed off and completed.');
    }

    // 2. Fetch Project details
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('*, client:clients(*)')
      .eq('id', projectId)
      .single();

    if (projErr) throw projErr;

    // 3. Upload Client Signature
    let signaturePath = '';
    const base64Data = params.signature_base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const signatureFilename = `handover_sigs/${projectId}_${Date.now()}.png`;

    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('private_documents')
      .upload(signatureFilename, buffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadErr) throw new Error(`Failed to upload signature file: ${uploadErr.message}`);
    signaturePath = uploadData?.path || '';

    // Register signature in DMS documents as well
    const { data: docRecord } = await supabase
      .from('documents')
      .insert({
        title: `Handover Certificate Signature - ${project.name}`,
        file_path: signaturePath,
        category: 'CONTRACT',
        file_type: 'image/png',
        project_id: projectId,
        uploaded_by: user.id
      })
      .select()
      .single();

    const todayDate = new Date().toISOString().split('T')[0];

    // 4. Perform Retention Release Calculations
    // Retrieve total retention held from project_retention_ledger
    const { data: retentionHeldRows, error: retErr } = await supabase
      .from('project_retention_ledger')
      .select('amount')
      .eq('project_id', projectId)
      .eq('direction', 'HELD');

    if (retErr) throw retErr;

    let totalRetentionHeld = (retentionHeldRows || []).reduce((acc, row) => acc + Number(row.amount), 0);

    // Fallback: If ledger is empty, estimate from project contract value
    if (totalRetentionHeld === 0) {
      const retPct = Number(project.retention_pct) || 5.00;
      totalRetentionHeld = Number(project.contract_value) * (retPct / 100);
    }

    const firstReleaseAmount = Number((totalRetentionHeld / 2).toFixed(2));
    const secondReleaseAmount = Number((totalRetentionHeld - firstReleaseAmount).toFixed(2));

    const dlpMonths = project.dlp_months || 12;
    const dlpStartDateStr = todayDate;
    const dlpEndDate = new Date();
    dlpEndDate.setMonth(dlpEndDate.getMonth() + dlpMonths);
    const dlpEndDateStr = dlpEndDate.toISOString().split('T')[0];

    // Insert release invoice 1 (DRAFT - Immediate release)
    const { data: inv1, error: inv1Err } = await supabase
      .from('client_invoices')
      .insert({
        project_id: projectId,
        client_id: project.client_id,
        client_name: project.client_name,
        client_trn: project.client.trn_number || null,
        client_address: project.client.billing_address || null,
        invoice_type: 'RETENTION_RELEASE',
        status: 'DRAFT',
        invoice_date: todayDate,
        supply_date: todayDate,
        due_date: todayDate,
        gross_claim: firstReleaseAmount,
        taxable_amount: firstReleaseAmount,
        vat_amount: 0.00,
        total_incl_vat: firstReleaseAmount,
        net_due: firstReleaseAmount,
        amount_paid: 0.00,
        notes: `50% Retention Release upon Handover Certificate sign-off.`,
        created_by: user.id
      })
      .select()
      .single();

    if (inv1Err) throw inv1Err;

    // Insert ledger record for release 1
    const { error: ledger1Err } = await supabase
      .from('project_retention_ledger')
      .insert({
        project_id: projectId,
        invoice_id: inv1.id,
        direction: 'RELEASED',
        amount: firstReleaseAmount,
        expected_release_date: todayDate
      });

    if (ledger1Err) throw ledger1Err;

    // Insert release invoice 2 (DRAFT - Release at end of DLP)
    const { data: inv2, error: inv2Err } = await supabase
      .from('client_invoices')
      .insert({
        project_id: projectId,
        client_id: project.client_id,
        client_name: project.client_name,
        client_trn: project.client.trn_number || null,
        client_address: project.client.billing_address || null,
        invoice_type: 'RETENTION_RELEASE',
        status: 'DRAFT',
        invoice_date: dlpEndDateStr,
        supply_date: dlpEndDateStr,
        due_date: dlpEndDateStr,
        gross_claim: secondReleaseAmount,
        taxable_amount: secondReleaseAmount,
        vat_amount: 0.00,
        total_incl_vat: secondReleaseAmount,
        net_due: secondReleaseAmount,
        amount_paid: 0.00,
        notes: `Remaining 50% Retention Release due at end of DLP period.`,
        created_by: user.id
      })
      .select()
      .single();

    if (inv2Err) throw inv2Err;

    // Insert ledger record for release 2
    const { error: ledger2Err } = await supabase
      .from('project_retention_ledger')
      .insert({
        project_id: projectId,
        invoice_id: inv2.id,
        direction: 'RELEASED',
        amount: secondReleaseAmount,
        expected_release_date: dlpEndDateStr
      });

    if (ledger2Err) throw ledger2Err;

    // 5. Update Handover Package
    const { data: updatedPkg, error: updatePkgErr } = await supabase
      .from('handover_packages')
      .update({
        status: 'COMPLETED',
        handover_date: todayDate,
        client_signatory_name: params.client_signatory_name,
        client_signatory_designation: params.client_signatory_designation,
        signature_path: signaturePath,
        certificate_document_id: docRecord?.id || null,
        dlp_start_confirmed: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', pkg.id)
      .select()
      .single();

    if (updatePkgErr) throw updatePkgErr;

    // 6. Transition Project Status to DLP
    const { error: projUpdateErr } = await supabase
      .from('projects')
      .update({
        status: 'DLP',
        dlp_start_date: dlpStartDateStr,
        dlp_end_date: dlpEndDateStr,
        actual_end_date: todayDate
      })
      .eq('id', projectId);

    if (projUpdateErr) throw projUpdateErr;

    // 7. Emit events
    // A. project.handed_over (Triggers account/coordinators notifications)
    await eventService.emitEvent(
      'project.handed_over',
      'PROJECT',
      projectId,
      projectId,
      {
        project_number: project.project_number,
        project_name: project.name,
        dlp_end_date: dlpEndDateStr,
        retention_release_1_amount: firstReleaseAmount,
        retention_release_2_amount: secondReleaseAmount
      }
    );

    // B. amc.opportunity (Triggers commercial team AMC preparation task)
    await eventService.emitEvent(
      'amc.opportunity',
      'PROJECT',
      projectId,
      projectId,
      {
        project_number: project.project_number,
        project_name: project.name,
        dlp_end_date: dlpEndDateStr
      }
    );

    return this.getHandoverPackage(projectId).then(res => res!);
  }
};

export default handoverService;
