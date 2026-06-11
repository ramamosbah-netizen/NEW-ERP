import pg from 'pg';
import fs from 'fs';

const { Client } = pg;

// Construct connection URL with password
const rawUrl = 'postgresql://postgres.renqeeaabnqoikhvczww@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
const password = 'AzadSali4347';
const connectionString = rawUrl.replace('postgres.renqeeaabnqoikhvczww@', `postgres.renqeeaabnqoikhvczww:${password}@`);

console.log('Connecting to database...');
const client = new Client({ connectionString });

async function run() {
  try {
    await client.connect();
    console.log('✅ Connected successfully!');

    // 1. Check and Apply schema-hr.sql (Employees and Compensation)
    console.log('\n--- 1. Checking HR / Employees Schema ---');
    const { rows: hrCheck } = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'employees'
      );
    `);

    if (!hrCheck[0].exists) {
      console.log('employees table is missing. Loading and executing schema-hr.sql...');
      const hrSql = fs.readFileSync('supabase/schema-hr.sql', 'utf8');
      
      // Execute the schema SQL
      await client.query(hrSql);
      console.log('✅ schema-hr.sql applied successfully!');
    } else {
      console.log('✅ employees table already exists.');
    }

    // 2. Check and Apply schema-inventory.sql (Stores, Items, Tools)
    console.log('\n--- 2. Checking Inventory / Tools Schema ---');
    const { rows: invCheck } = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tools'
      );
    `);

    if (!invCheck[0].exists) {
      console.log('tools table is missing. Loading and executing schema-inventory.sql...');
      const invSql = fs.readFileSync('supabase/schema-inventory.sql', 'utf8');
      
      // Execute the schema SQL
      await client.query(invSql);
      console.log('✅ schema-inventory.sql applied successfully!');
    } else {
      console.log('✅ tools table already exists.');
    }

    // 3. Check and Apply schema-fleet-assets.sql (Vehicles, Fixed Assets)
    console.log('\n--- 3. Checking Fleet Assets Schema ---');
    const { rows: fleetCheck } = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'fixed_assets'
      );
    `);
    
    if (!fleetCheck[0].exists) {
      console.log('fixed_assets table is missing. Loading and executing schema-fleet-assets.sql...');
      const fleetSql = fs.readFileSync('supabase/schema-fleet-assets.sql', 'utf8');
      
      // Execute the schema SQL
      await client.query(fleetSql);
      console.log('✅ schema-fleet-assets.sql applied successfully!');
    } else {
      console.log('✅ fixed_assets table already exists.');
    }

    // 4. Fix user_roles infinite recursion policy
    console.log('\n--- 4. Fixing user_roles infinite recursion RLS policy ---');
    await client.query(`
      DROP POLICY IF EXISTS "Allow admin write to user_roles" ON public.user_roles;
      CREATE POLICY "Allow admin write to user_roles" ON public.user_roles FOR ALL TO authenticated USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'admin'
        )
      );
      
      -- Also verify read policy
      DROP POLICY IF EXISTS "Allow authenticated read to user_roles" ON public.user_roles;
      CREATE POLICY "Allow authenticated read to user_roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
    `);
    console.log('✅ user_roles RLS policies updated!');

    // 5. Drop and recreate FKs to public.profiles(id) for relationship resolution in PostgREST
    console.log('\n--- 5. Altering Foreign Keys to point to public.profiles ---');
    
    // This PL/pgSQL block drops existing foreign key constraints on the target columns
    await client.query(`
      DO $$
      DECLARE
          r RECORD;
      BEGIN
          FOR r IN (
              SELECT tc.constraint_name, tc.table_name 
              FROM information_schema.table_constraints tc 
              JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name 
                AND tc.table_schema = kcu.table_schema
              WHERE tc.constraint_type = 'FOREIGN KEY' 
                AND tc.table_schema = 'public'
                AND (
                  (tc.table_name = 'tasks' AND kcu.column_name IN ('assignee_id', 'created_by')) OR
                  (tc.table_name = 'meetings' AND kcu.column_name = 'organizer_id') OR
                  (tc.table_name = 'meeting_action_items' AND kcu.column_name = 'assignee_id') OR
                  (tc.table_name = 'task_comments' AND kcu.column_name = 'user_id')
                )
          ) LOOP
              EXECUTE 'ALTER TABLE public.' || quote_ident(r.table_name) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
          END LOOP;
      END $$;
    `);
    
    // Add constraints pointing to public.profiles(id)
    await client.query(`
      -- tasks
      ALTER TABLE public.tasks 
        ADD CONSTRAINT tasks_assignee_id_profiles_fkey FOREIGN KEY (assignee_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
        ADD CONSTRAINT tasks_created_by_profiles_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;

      -- meetings
      ALTER TABLE public.meetings 
        ADD CONSTRAINT meetings_organizer_id_profiles_fkey FOREIGN KEY (organizer_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

      -- meeting_action_items
      ALTER TABLE public.meeting_action_items 
        ADD CONSTRAINT meeting_action_items_assignee_id_profiles_fkey FOREIGN KEY (assignee_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

      -- task_comments
      ALTER TABLE public.task_comments 
        ADD CONSTRAINT task_comments_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;
    `);
    console.log('✅ Foreign keys updated to reference profiles(id)!');

    // 6. Force PostgREST schema cache reload
    console.log('\n--- 6. Reloading PostgREST Schema Cache ---');
    await client.query('NOTIFY pgrst, \'reload schema\';');
    console.log('✅ PostgREST schema cache reload notification sent!');

  } catch (err) {
    console.error('❌ Error applying DB fixes:', err);
  } finally {
    await client.end();
    console.log('\nDisconnected.');
  }
}

run();
