import pg from 'pg';
const { Client } = pg;

const rawUrl = 'postgresql://postgres.renqeeaabnqoikhvczww@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
const password = 'AzadSali4347';
const connectionString = rawUrl.replace('postgres.renqeeaabnqoikhvczww@', `postgres.renqeeaabnqoikhvczww:${password}@`);

const queries = [
  // 1. Drop duplicate meetings projects constraint if exists
  `ALTER TABLE public.meetings DROP CONSTRAINT IF EXISTS meetings_project_id_projects_fkey;`,

  // 2. Clean up service_tickets technician constraints
  `ALTER TABLE public.service_tickets DROP CONSTRAINT IF EXISTS service_tickets_technician_id_profiles_fkey;`,
  `ALTER TABLE public.service_tickets DROP CONSTRAINT IF EXISTS service_tickets_technician_id_fkey;`,
  `ALTER TABLE public.service_tickets ADD CONSTRAINT service_tickets_technician_id_fkey 
    FOREIGN KEY (technician_id) REFERENCES public.profiles(id) ON DELETE SET NULL;`,

  // 3. Add purchase_orders project constraint
  `ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_project_id_fkey;`,
  `ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_project_id_fkey 
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;`,

  // 4. Add whatsapp_chats assigned_to profile constraint
  `ALTER TABLE public.whatsapp_chats DROP CONSTRAINT IF EXISTS whatsapp_chats_assigned_to_profiles_fkey;`,
  `ALTER TABLE public.whatsapp_chats ADD CONSTRAINT whatsapp_chats_assigned_to_profiles_fkey 
    FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;`,

  // 5. Add tc_test_results tested_by profile constraint
  `ALTER TABLE public.tc_test_results DROP CONSTRAINT IF EXISTS tc_test_results_tested_by_fkey;`,
  `ALTER TABLE public.tc_test_results ADD CONSTRAINT tc_test_results_tested_by_fkey 
    FOREIGN KEY (tested_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;`,

  // 6. Add vehicles assigned_driver_id employee constraint
  `ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_assigned_driver_id_employees_fkey;`,
  `ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_assigned_driver_id_employees_fkey 
    FOREIGN KEY (assigned_driver_id) REFERENCES public.employees(id) ON DELETE SET NULL;`,

  // 7. Add vehicle_assignments driver and project constraints
  `ALTER TABLE public.vehicle_assignments DROP CONSTRAINT IF EXISTS vehicle_assignments_driver_id_employees_fkey;`,
  `ALTER TABLE public.vehicle_assignments ADD CONSTRAINT vehicle_assignments_driver_id_employees_fkey 
    FOREIGN KEY (driver_id) REFERENCES public.employees(id) ON DELETE CASCADE;`,

  `ALTER TABLE public.vehicle_assignments DROP CONSTRAINT IF EXISTS vehicle_assignments_project_id_projects_fkey;`,
  `ALTER TABLE public.vehicle_assignments ADD CONSTRAINT vehicle_assignments_project_id_projects_fkey 
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;`,

  // 8. Add fuel_logs driver and project constraints
  `ALTER TABLE public.fuel_logs DROP CONSTRAINT IF EXISTS fuel_logs_driver_id_employees_fkey;`,
  `ALTER TABLE public.fuel_logs ADD CONSTRAINT fuel_logs_driver_id_employees_fkey 
    FOREIGN KEY (driver_id) REFERENCES public.employees(id) ON DELETE SET NULL;`,

  `ALTER TABLE public.fuel_logs DROP CONSTRAINT IF EXISTS fuel_logs_project_id_projects_fkey;`,
  `ALTER TABLE public.fuel_logs ADD CONSTRAINT fuel_logs_project_id_projects_fkey 
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;`,

  // 9. Add vehicle_fines driver constraint
  `ALTER TABLE public.vehicle_fines DROP CONSTRAINT IF EXISTS vehicle_fines_driver_id_employees_fkey;`,
  `ALTER TABLE public.vehicle_fines ADD CONSTRAINT vehicle_fines_driver_id_employees_fkey 
    FOREIGN KEY (driver_id) REFERENCES public.employees(id) ON DELETE SET NULL;`,

  // 10. Reload PostgREST Cache
  `NOTIFY pgrst, 'reload schema';`
];

async function applyFixes() {
  const client = new Client({ connectionString });
  try {
    console.log('Connecting to Supabase PG pool...');
    await client.connect();
    console.log('✅ Connected successfully!');

    console.log('\n--- Applying Schema Relationship Corrections ---');
    for (let i = 0; i < queries.length; i++) {
      console.log(`Executing step ${i + 1}/${queries.length}...`);
      await client.query(queries[i]);
    }
    console.log('✅ All queries completed successfully!');

  } catch (err) {
    console.error('❌ Database error applying relationship fixes:', err);
  } finally {
    await client.end();
    console.log('Disconnected.');
  }
}

applyFixes();
