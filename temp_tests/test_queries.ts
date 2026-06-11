import fs from 'fs';

// Parse .env.local manually and set env vars
try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    }
  }
} catch (err: any) {
  console.error('Warning: Failed to load .env.local:', err.message);
}

async function runTests() {
  const { supabase } = await import('../src/lib/supabase');

  console.log('--- RUNNING RELATIONSHIP QUERY TESTS ---');

  // Test 1: service_tickets -> clients & profiles
  try {
    const { data, error } = await supabase
      .from('service_tickets')
      .select('*, clients(name), profiles!service_tickets_technician_id_fkey(full_name)')
      .limit(1);
    if (error) throw error;
    console.log('✅ service_tickets query successful!');
  } catch (err: any) {
    console.error('❌ service_tickets query failed:', err.message);
  }

  // Test 2: meetings -> projects & profiles
  try {
    const { data, error } = await supabase
      .from('meetings')
      .select('*, project:projects(name), organizer:profiles!organizer_id(full_name)')
      .limit(1);
    if (error) throw error;
    console.log('✅ meetings query successful!');
  } catch (err: any) {
    console.error('❌ meetings query failed:', err.message);
  }

  // Test 3: purchase_orders -> projects & profiles
  try {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, projects(project_number, name), profiles:created_by(full_name)')
      .limit(1);
    if (error) throw error;
    console.log('✅ purchase_orders query successful!');
  } catch (err: any) {
    console.error('❌ purchase_orders query failed:', err.message);
  }

  // Test 4: whatsapp_chats -> clients & amc_contracts & profiles
  try {
    const { data, error } = await supabase
      .from('whatsapp_chats')
      .select('*, client:clients(name), contract:amc_contracts(contract_number, site_name), agent:profiles!assigned_to(full_name)')
      .limit(1);
    if (error) throw error;
    console.log('✅ whatsapp_chats query successful!');
  } catch (err: any) {
    console.error('❌ whatsapp_chats query failed:', err.message);
  }

  // Test 5: tc_test_results -> tester
  try {
    const { data, error } = await supabase
      .from('tc_test_results')
      .select('*, tester:profiles!tc_test_results_tested_by_fkey(full_name)')
      .limit(1);
    if (error) throw error;
    console.log('✅ tc_test_results query successful!');
  } catch (err: any) {
    console.error('❌ tc_test_results query failed:', err.message);
  }

  // Test 6: vehicles -> employees & fixed_assets
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*, employees:assigned_driver_id(full_name_en), fixed_assets:fixed_asset_id(asset_number)')
      .limit(1);
    if (error) throw error;
    console.log('✅ vehicles query successful!');
  } catch (err: any) {
    console.error('❌ vehicles query failed:', err.message);
  }

  // Test 7: vehicle_assignments -> employees & vehicles & projects
  try {
    const { data, error } = await supabase
      .from('vehicle_assignments')
      .select('*, employees:driver_id(full_name_en), vehicles:vehicle_id(vehicle_code, plate_number), projects:project_id(name)')
      .limit(1);
    if (error) throw error;
    console.log('✅ vehicle_assignments query successful!');
  } catch (err: any) {
    console.error('❌ vehicle_assignments query failed:', err.message);
  }

  // Test 8: fuel_logs -> employees & vehicles
  try {
    const { data, error } = await supabase
      .from('fuel_logs')
      .select('*, employees:driver_id(full_name_en), vehicles:vehicle_id(vehicle_code)')
      .limit(1);
    if (error) throw error;
    console.log('✅ fuel_logs query successful!');
  } catch (err: any) {
    console.error('❌ fuel_logs query failed:', err.message);
  }

  // Test 9: vehicle_fines -> employees & vehicles
  try {
    const { data, error } = await supabase
      .from('vehicle_fines')
      .select('*, employees:driver_id(full_name_en), vehicles:vehicle_id(vehicle_code)')
      .limit(1);
    if (error) throw error;
    console.log('✅ vehicle_fines query successful!');
  } catch (err: any) {
    console.error('❌ vehicle_fines query failed:', err.message);
  }

  // Test 10: fixed_assets -> supplier, custodian, vehicle, tool joins
  try {
    const { data, error } = await supabase
      .from('fixed_assets')
      .select('*, pricing_suppliers:supplier_id(name), employees:custodian_id(full_name_en), vehicles:linked_vehicle_id(vehicle_code), tools:linked_tool_id(tool_number)')
      .limit(1);
    if (error) throw error;
    console.log('✅ fixed_assets query successful!');
  } catch (err: any) {
    console.error('❌ fixed_assets query failed:', err.message);
  }

  // Test 11: ppm_visits -> amc_contracts & profiles join
  try {
    const { data, error } = await supabase
      .from('ppm_visits')
      .select('*, amc_contracts(contract_number, client_name, site_name, site_address, emirate), profiles!ppm_visits_technician_id_fkey(full_name)')
      .limit(1);
    if (error) throw error;
    console.log('✅ ppm_visits query successful!');
  } catch (err: any) {
    console.error('❌ ppm_visits query failed:', err.message);
  }

  // Test 12: grns -> purchase_orders & projects & profiles join
  try {
    const { data, error } = await supabase
      .from('grns')
      .select('*, purchase_orders(po_number), projects(project_number, name), profiles:received_by(full_name)')
      .limit(1);
    if (error) throw error;
    console.log('✅ grns query successful!');
  } catch (err: any) {
    console.error('❌ grns query failed:', err.message);
  }
}

runTests();
