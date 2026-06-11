import pg from 'pg';
const { Client } = pg;

const rawUrl = 'postgresql://postgres.renqeeaabnqoikhvczww@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
const password = 'AzadSali4347';
const connectionString = rawUrl.replace('postgres.renqeeaabnqoikhvczww@', `postgres.renqeeaabnqoikhvczww:${password}@`);

const queries = [
  // 1. Extend projects.status check constraint to support SUBMITTED and LOST
  `ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;`,
  `ALTER TABLE public.projects ADD CONSTRAINT projects_status_check CHECK (status IN (
    'SUBMITTED', 'MOBILIZATION', 'IN_PROGRESS', 'TESTING', 'HANDOVER', 'DLP', 'CLOSED',
    'ON_HOLD', 'CANCELLED', 'LOST'
  ));`,
  `ALTER TABLE public.projects ALTER COLUMN status SET DEFAULT 'SUBMITTED';`,

  // 2. Add project_id FKs to pre-award tables
  `ALTER TABLE public.tenders ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;`,
  `ALTER TABLE public.boqs ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;`,
  `ALTER TABLE public.tender_documents ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;`,

  // 3. Add actual_project_id FKs to quotation and comparison tables
  `ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS actual_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;`,
  `ALTER TABLE public.supplier_comparisons ADD COLUMN IF NOT EXISTS actual_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;`,

  // 4. Create indexes for performance
  `CREATE INDEX IF NOT EXISTS idx_tenders_project_id ON public.tenders(project_id);`,
  `CREATE INDEX IF NOT EXISTS idx_boqs_project_id ON public.boqs(project_id);`,
  `CREATE INDEX IF NOT EXISTS idx_tender_documents_project_id ON public.tender_documents(project_id);`,
  `CREATE INDEX IF NOT EXISTS idx_quotations_actual_project_id ON public.quotations(actual_project_id);`,
  `CREATE INDEX IF NOT EXISTS idx_supplier_comparisons_actual_project_id ON public.supplier_comparisons(actual_project_id);`,

  // 5. Reload PostgREST Cache
  `NOTIFY pgrst, 'reload schema';`
];

async function applyFixes() {
  const client = new Client({ connectionString });
  try {
    console.log('Connecting to Supabase PG pool...');
    await client.connect();
    console.log('✅ Connected successfully!');

    console.log('\n--- Applying Project Auto-Creation Schema Updates ---');
    for (let i = 0; i < queries.length; i++) {
      console.log(`Executing step ${i + 1}/${queries.length}...`);
      await client.query(queries[i]);
    }
    console.log('✅ All queries completed successfully!');

  } catch (err) {
    console.error('❌ Database error applying schema updates:', err);
  } finally {
    await client.end();
    console.log('Disconnected.');
  }
}

applyFixes();
