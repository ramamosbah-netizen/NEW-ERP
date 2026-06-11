import pg from 'pg';
const { Client } = pg;

const rawUrl = 'postgresql://postgres.renqeeaabnqoikhvczww@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
const password = 'AzadSali4347';
const connectionString = rawUrl.replace('postgres.renqeeaabnqoikhvczww@', `postgres.renqeeaabnqoikhvczww:${password}@`);

const queries = [
  // 1. Add fixed_assets custodian and tool constraints
  `ALTER TABLE public.fixed_assets DROP CONSTRAINT IF EXISTS fixed_assets_custodian_id_employees_fkey;`,
  `ALTER TABLE public.fixed_assets ADD CONSTRAINT fixed_assets_custodian_id_employees_fkey 
    FOREIGN KEY (custodian_id) REFERENCES public.employees(id) ON DELETE SET NULL;`,

  `ALTER TABLE public.fixed_assets DROP CONSTRAINT IF EXISTS fixed_assets_linked_tool_id_tools_fkey;`,
  `ALTER TABLE public.fixed_assets ADD CONSTRAINT fixed_assets_linked_tool_id_tools_fkey 
    FOREIGN KEY (linked_tool_id) REFERENCES public.tools(id) ON DELETE SET NULL;`,

  // 2. Add ppm_visits technician constraints
  `ALTER TABLE public.ppm_visits DROP CONSTRAINT IF EXISTS ppm_visits_technician_id_fkey;`,
  `ALTER TABLE public.ppm_visits ADD CONSTRAINT ppm_visits_technician_id_fkey 
    FOREIGN KEY (technician_id) REFERENCES public.profiles(id) ON DELETE SET NULL;`,

  `ALTER TABLE public.ppm_visits DROP CONSTRAINT IF EXISTS ppm_visits_second_technician_id_fkey;`,
  `ALTER TABLE public.ppm_visits ADD CONSTRAINT ppm_visits_second_technician_id_fkey 
    FOREIGN KEY (second_technician_id) REFERENCES public.profiles(id) ON DELETE SET NULL;`,

  // 3. Add grns project and received_by constraints
  `ALTER TABLE public.grns DROP CONSTRAINT IF EXISTS grns_project_id_projects_fkey;`,
  `ALTER TABLE public.grns ADD CONSTRAINT grns_project_id_projects_fkey 
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;`,

  `ALTER TABLE public.grns DROP CONSTRAINT IF EXISTS grns_received_by_fkey;`,
  `ALTER TABLE public.grns DROP CONSTRAINT IF EXISTS grns_received_by_profiles_fkey;`,
  `ALTER TABLE public.grns ADD CONSTRAINT grns_received_by_profiles_fkey 
    FOREIGN KEY (received_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;`,

  // 4. Reload PostgREST Cache
  `NOTIFY pgrst, 'reload schema';`
];

async function applyFixes() {
  const client = new Client({ connectionString });
  try {
    console.log('Connecting to Supabase PG pool...');
    await client.connect();
    console.log('✅ Connected successfully!');

    console.log('\n--- Applying Final Schema Relationship Corrections ---');
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
