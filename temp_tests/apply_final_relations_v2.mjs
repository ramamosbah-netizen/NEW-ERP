import pg from 'pg';
const { Client } = pg;

const rawUrl = 'postgresql://postgres.renqeeaabnqoikhvczww@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
const password = 'AzadSali4347';
const connectionString = rawUrl.replace('postgres.renqeeaabnqoikhvczww@', `postgres.renqeeaabnqoikhvczww:${password}@`);

const queries = [
  // Drop current created_by FK on purchase_orders
  `ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_created_by_fkey;`,
  // Add new created_by FK referencing public.profiles(id)
  `ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_created_by_profiles_fkey 
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;`,
  // Reload cache
  `NOTIFY pgrst, 'reload schema';`
];

async function applyFixes() {
  const client = new Client({ connectionString });
  try {
    console.log('Connecting...');
    await client.connect();
    console.log('✅ Connected!');

    for (let i = 0; i < queries.length; i++) {
      console.log(`Running step ${i + 1}...`);
      await client.query(queries[i]);
    }
    console.log('✅ Done!');
  } catch (err) {
    console.error('❌ DB Error:', err);
  } finally {
    await client.end();
  }
}

applyFixes();
