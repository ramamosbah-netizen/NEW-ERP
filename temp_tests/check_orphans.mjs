import pg from 'pg';
const { Client } = pg;

const rawUrl = 'postgresql://postgres.renqeeaabnqoikhvczww@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
const password = 'AzadSali4347';
const connectionString = rawUrl.replace('postgres.renqeeaabnqoikhvczww@', `postgres.renqeeaabnqoikhvczww:${password}@`);

async function runCheck() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to Database. Checking orphans...');

  const query = `
    SELECT 'tasks.assignee_id' AS col, t.assignee_id AS missing_id
      FROM public.tasks t LEFT JOIN public.profiles p ON p.id = t.assignee_id
      WHERE t.assignee_id IS NOT NULL AND p.id IS NULL
    UNION ALL
    SELECT 'tasks.created_by', t.created_by
      FROM public.tasks t LEFT JOIN public.profiles p ON p.id = t.created_by
      WHERE t.created_by IS NOT NULL AND p.id IS NULL
    UNION ALL
    SELECT 'meetings.organizer_id', m.organizer_id
      FROM public.meetings m LEFT JOIN public.profiles p ON p.id = m.organizer_id
      WHERE m.organizer_id IS NOT NULL AND p.id IS NULL
    UNION ALL
    SELECT 'whatsapp_conversations.assigned_to', w.assigned_to
      FROM public.whatsapp_conversations w LEFT JOIN public.profiles p ON p.id = w.assigned_to
      WHERE w.assigned_to IS NOT NULL AND p.id IS NULL;
  `;

  const res = await client.query(query);
  console.log('\n--- ORPHAN CHECK RESULTS ---');
  if (res.rows.length === 0) {
    console.log('No orphans found! It is 100% safe to apply the foreign key alters.');
  } else {
    console.log(`Found ${res.rows.length} orphan rows:`);
    console.table(res.rows);
  }
  console.log('----------------------------\n');

  await client.end();
}

runCheck().catch(console.error);
