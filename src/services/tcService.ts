// ============================================================
// JEET ERP — Testing & Commissioning (T&C) Service
// ============================================================

import { supabase } from '@/lib/supabase';
import { TCPackage, TCTestScript, TCDevice, TCTestResult, TCWitness, TCPackageStatus, WitnessRequired } from '@/types/tc.types';
import { snagService } from './snagService';
import { eventService } from './eventService';

// PostgREST embeds are unreliable in this setup (tc_packages has no FK to
// profiles → PGRST200). Enrich rows with project/engineer/creator names via
// batched separate keyed lookups instead.
async function enrichPackages(rows: any[]): Promise<TCPackage[]> {
  if (!rows.length) return [];
  const projectIds = [...new Set(rows.map(r => r.project_id).filter(Boolean))];
  const profileIds = [...new Set(rows.flatMap(r => [r.assigned_engineer_id, r.created_by]).filter(Boolean))];
  const [projRes, profRes] = await Promise.all([
    projectIds.length ? supabase.from('projects').select('id, name, project_number').in('id', projectIds) : Promise.resolve({ data: [] as any[] }),
    profileIds.length ? supabase.from('profiles').select('id, full_name').in('id', profileIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const projMap = new Map((projRes.data || []).map((p: any) => [p.id, p]));
  const profMap = new Map((profRes.data || []).map((p: any) => [p.id, p.full_name]));
  return rows.map(r => ({
    ...r,
    project_name: projMap.get(r.project_id)?.name,
    project_number: projMap.get(r.project_id)?.project_number,
    assigned_engineer_name: r.assigned_engineer_id ? profMap.get(r.assigned_engineer_id) : undefined,
    created_by_name: r.created_by ? profMap.get(r.created_by) : undefined,
  })) as TCPackage[];
}

export const tcService = {
  /**
   * Retrieves all active T&C packages for a specific project.
   */
  async getPackagesByProject(projectId: string): Promise<TCPackage[]> {
    const { data, error } = await supabase
      .from('tc_packages')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return enrichPackages(data || []);
  },

  /**
   * Retrieves a single T&C package by ID.
   */
  async getPackageById(packageId: string): Promise<TCPackage> {
    const { data, error } = await supabase
      .from('tc_packages')
      .select('*')
      .eq('id', packageId)
      .single();

    if (error) throw error;

    return (await enrichPackages([data]))[0];
  },

  /**
   * Creates a new T&C package, optionally instantiating scripts from a template.
   */
  async createPackage(params: {
    project_id: string;
    system: string;
    title: string;
    assigned_engineer_id?: string;
    witness_required: WitnessRequired;
    notes?: string;
    templateId?: string; // If provided, scripts will be copied from this template
  }): Promise<TCPackage> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required to create T&C package');

    // 1. Create the package record (triggers auto-generation of package_number)
    const { data: pkg, error: pkgErr } = await supabase
      .from('tc_packages')
      .insert({
        project_id: params.project_id,
        system: params.system,
        title: params.title,
        status: 'DRAFT',
        assigned_engineer_id: params.assigned_engineer_id || null,
        witness_required: params.witness_required,
        notes: params.notes || null,
        created_by: user.id,
        completion_pct: 0.00
      })
      .select()
      .single();

    if (pkgErr) throw pkgErr;

    // 2. If a template is selected, copy template items to the package test scripts
    if (params.templateId) {
      const { data: templateItems, error: itemsErr } = await supabase
        .from('tc_script_template_items')
        .select('*')
        .eq('template_id', params.templateId)
        .order('sort_order', { ascending: true });

      if (itemsErr) throw itemsErr;

      if (templateItems && templateItems.length > 0) {
        const scriptsToInsert = templateItems.map(item => ({
          package_id: pkg.id,
          script_type: item.script_type,
          title: item.test_item,
          expected: item.expected,
          sort_order: item.sort_order
        }));

        const { error: insertErr } = await supabase
          .from('tc_test_scripts')
          .insert(scriptsToInsert);

        if (insertErr) throw insertErr;
      }
    }

    return this.getPackageById(pkg.id);
  },

  /**
   * Retrieves test scripts for a package.
   */
  async getTestScripts(packageId: string): Promise<TCTestScript[]> {
    const { data, error } = await supabase
      .from('tc_test_scripts')
      .select('*')
      .eq('package_id', packageId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data as TCTestScript[];
  },

  /**
   * Retrieves devices linked to a package.
   */
  async getDevices(packageId: string): Promise<TCDevice[]> {
    const { data, error } = await supabase
      .from('tc_devices')
      .select('*')
      .eq('package_id', packageId)
      .order('label', { ascending: true });

    if (error) throw error;
    return data as TCDevice[];
  },

  /**
   * Logs a test execution result. If test fails, auto-creates a snag and links it.
   */
  async logTestResult(params: {
    script_id: string;
    device_id?: string;
    result: 'PASS' | 'FAIL' | 'NA';
    measured_value?: string;
    photo_paths?: string[];
    retest_of_id?: string;
    measuring_instrument_id?: string;
  }): Promise<TCTestResult> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required to log test result');

    // Fetch script details
    const { data: script, error: scriptErr } = await supabase
      .from('tc_test_scripts')
      .select('*, package:tc_packages(*)')
      .eq('id', params.script_id)
      .single();

    if (scriptErr) throw scriptErr;

    // Fetch device details if device_id is present
    let device: TCDevice | null = null;
    if (params.device_id) {
      const { data: devData, error: devErr } = await supabase
        .from('tc_devices')
        .select('*')
        .eq('id', params.device_id)
        .single();
      if (devErr) throw devErr;
      device = devData as TCDevice;
    }

    // 1. Insert test result (immutable log)
    const { data: res, error: resErr } = await supabase
      .from('tc_test_results')
      .insert({
        script_id: params.script_id,
        device_id: params.device_id || null,
        test_item: script.title,
        expected: script.expected,
        result: params.result,
        measured_value: params.measured_value || null,
        photo_paths: params.photo_paths || [],
        tested_by: user.id,
        retest_of_id: params.retest_of_id || null,
        measuring_instrument_id: params.measuring_instrument_id || null
      })
      .select()
      .single();

    if (resErr) throw resErr;

    let linkedSnagId: string | null = null;

    // 2. If FAILED, auto-generate open snag
    if (params.result === 'FAIL') {
      const locationStr = device ? device.location : 'System Level';
      const deviceLabelStr = device ? ` on Device ${device.label}` : '';
      const description = `T&C failure logged${deviceLabelStr} for test item "${script.title}". Expected: ${script.expected}. Measured/Actual: ${params.measured_value || 'None logged'}.`;

      const snag = await snagService.createSnag({
        project_id: script.package.project_id,
        source: 'TC_FAIL',
        system: script.package.system,
        location: locationStr,
        description: description,
        photo_paths: params.photo_paths || [],
        severity: 'MAJOR',
        tc_test_result_id: res.id
      });

      linkedSnagId = snag.id;

      // Update the test result with snag reference
      await supabase
        .from('tc_test_results')
        .update({ snag_id: linkedSnagId })
        .eq('id', res.id);
    }

    // 3. Update device status if device-level test
    if (params.device_id) {
      const dbStatus = params.result === 'PASS' ? 'PASSED' : params.result === 'FAIL' ? 'FAILED' : 'NA';
      await supabase
        .from('tc_devices')
        .update({ status: dbStatus })
        .eq('id', params.device_id);
    }

    // 4. Update Package completion percentage & package status to IN_PROGRESS if not already
    await this.recalculatePackageProgress(script.package.id);

    return {
      ...res,
      device_label: device?.label,
      device_location: device?.location,
      snag_id: linkedSnagId || undefined
    } as TCTestResult;
  },

  /**
   * Recalculates progress percentage and updates package status.
   */
  async recalculatePackageProgress(packageId: string): Promise<number> {
    // A package's completion relies on:
    // (a) Total devices: count how many are PASSED or NA out of all devices.
    // (b) Total scripts: count tests completed.
    // If device-level tests exist, the progress is calculated by device statuses.
    // Otherwise, it is calculated by system-level/integration script test results.
    
    // Check if package has devices
    const { count: totalDevices } = await supabase
      .from('tc_devices')
      .select('*', { count: 'exact', head: true })
      .eq('package_id', packageId);

    let progress = 0;

    if (totalDevices && totalDevices > 0) {
      // Calculate by devices
      const { count: passedOrNADevices } = await supabase
        .from('tc_devices')
        .select('*', { count: 'exact', head: true })
        .eq('package_id', packageId)
        .in('status', ['PASSED', 'NA']);
      
      progress = Math.round(((passedOrNADevices || 0) / totalDevices) * 100);
    } else {
      // Calculate by scripts
      const { data: scripts } = await supabase
        .from('tc_test_scripts')
        .select('id')
        .eq('package_id', packageId);

      const scriptIds = (scripts || []).map(s => s.id);
      if (scriptIds.length > 0) {
        // Find latest results for these scripts
        const { data: latestResults } = await supabase
          .from('tc_test_results')
          .select('script_id, result')
          .in('script_id', scriptIds);

        // Map by script_id to keep latest only
        const uniqueResults = new Map<string, string>();
        for (const r of latestResults || []) {
          uniqueResults.set(r.script_id, r.result);
        }

        let passedOrNA = 0;
        for (const res of uniqueResults.values()) {
          if (res === 'PASS' || res === 'NA') {
            passedOrNA++;
          }
        }
        progress = Math.round((passedOrNA / scriptIds.length) * 100);
      }
    }

    const { data: pkg } = await supabase
      .from('tc_packages')
      .select('status')
      .eq('id', packageId)
      .single();

    let newStatus = pkg?.status || 'DRAFT';
    if (newStatus === 'DRAFT' || newStatus === 'READY') {
      newStatus = 'IN_PROGRESS';
    }

    // If progress is 100% and it was in progress, set it to INTERNAL_PASSED
    if (progress === 100 && newStatus === 'IN_PROGRESS') {
      newStatus = 'INTERNAL_PASSED';
    } else if (progress < 100 && newStatus === 'INTERNAL_PASSED') {
      newStatus = 'IN_PROGRESS';
    }

    await supabase
      .from('tc_packages')
      .update({
        completion_pct: progress,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', packageId);

    return progress;
  },

  /**
   * Schedules a witness sign-off validation event.
   */
  async scheduleWitness(packageId: string, witnessDate: string): Promise<TCPackage> {
    const { data: pkg, error: fetchErr } = await supabase
      .from('tc_packages')
      .select('*')
      .eq('id', packageId)
      .single();

    if (fetchErr) throw fetchErr;

    const { data, error } = await supabase
      .from('tc_packages')
      .update({
        status: 'WITNESS_SCHEDULED',
        scheduled_witness_date: witnessDate,
        updated_at: new Date().toISOString()
      })
      .eq('id', packageId)
      .select()
      .single();

    if (error) throw error;

    // Emit event: tc.ready_for_witness
    await eventService.emitEvent(
      'tc.ready_for_witness',
      'TC_PACKAGE',
      pkg.id,
      pkg.project_id,
      {
        package_number: pkg.package_number,
        system: pkg.system,
        scheduled_witness_date: witnessDate
      }
    );

    return this.getPackageById(packageId);
  },

  /**
   * Submits witness sign-off.
   */
  async submitWitnessSignOff(params: {
    package_id: string;
    witness_stage: 'INTERNAL' | 'CONSULTANT' | 'CLIENT';
    witness_name: string;
    designation: string;
    company: string;
    signature_path?: string;
    result: 'APPROVED' | 'APPROVED_WITH_COMMENTS' | 'REJECTED';
    comments?: string;
  }): Promise<TCWitness> {
    const { data: pkg, error: pkgErr } = await supabase
      .from('tc_packages')
      .select('*')
      .eq('id', params.package_id)
      .single();

    if (pkgErr) throw pkgErr;

    // 1. Insert witness record
    const { data: witness, error: wErr } = await supabase
      .from('tc_witnesses')
      .insert({
        package_id: params.package_id,
        witness_stage: params.witness_stage,
        witness_name: params.witness_name,
        designation: params.designation,
        company: params.company,
        signature_path: params.signature_path || null,
        result: params.result,
        comments: params.comments || null
      })
      .select()
      .single();

    if (wErr) throw wErr;

    // 2. Adjust package status based on witness decision
    let nextStatus: TCPackageStatus = pkg.status;

    if (params.result === 'REJECTED') {
      nextStatus = 'FAILED_RETEST';
      
      // Auto-create a witness snag
      await snagService.createSnag({
        project_id: pkg.project_id,
        source: 'WITNESS',
        system: pkg.system,
        location: 'Witness Sign-off',
        description: `Witness sign-off REJECTED at stage ${params.witness_stage} by ${params.witness_name} (${params.company}). Comments: ${params.comments || 'No remarks'}`,
        severity: 'CRITICAL'
      });

      await supabase
        .from('tc_packages')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', pkg.id);

      // Emit event: tc.witness_rejected
      await eventService.emitEvent(
        'tc.witness_rejected',
        'TC_PACKAGE',
        pkg.id,
        pkg.project_id,
        {
          package_number: pkg.package_number,
          system: pkg.system,
          comments: params.comments,
          witness_name: params.witness_name
        }
      );
    } else {
      // APPROVED or APPROVED_WITH_COMMENTS
      const req = pkg.witness_required as WitnessRequired;

      if (params.witness_stage === 'INTERNAL') {
        if (req === 'INTERNAL_ONLY') {
          nextStatus = 'COMPLETED';
        } else {
          nextStatus = 'INTERNAL_PASSED';
        }
      } else if (params.witness_stage === 'CONSULTANT') {
        if (req === 'CONSULTANT' || req === 'INTERNAL_ONLY') {
          nextStatus = 'COMPLETED';
        } else {
          nextStatus = 'CONSULTANT_APPROVED';
        }
      } else if (params.witness_stage === 'CLIENT') {
        nextStatus = 'COMPLETED';
      }

      await supabase
        .from('tc_packages')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', pkg.id);

      // If package successfully COMPLETED, emit event
      if (nextStatus === 'COMPLETED') {
        await eventService.emitEvent(
          'tc.completed',
          'TC_PACKAGE',
          pkg.id,
          pkg.project_id,
          {
            package_number: pkg.package_number,
            system: pkg.system,
            witness_name: params.witness_name
          }
        );
      }
    }

    return witness as TCWitness;
  }
};

export default tcService;
