import pg from 'pg';
const { Client } = pg;

const rawUrl = 'postgresql://postgres.renqeeaabnqoikhvczww@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
const password = 'AzadSali4347';
const connectionString = rawUrl.replace('postgres.renqeeaabnqoikhvczww@', `postgres.renqeeaabnqoikhvczww:${password}@`);

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected!');

  const { rows } = await client.query(`
    SELECT 
        conname AS constraint_name, 
        conrelid::regclass AS table_name, 
        confrelid::regclass AS foreign_table_name,
        pg_get_constraintdef(oid) AS constraint_def
    FROM 
        pg_constraint 
    WHERE 
        conrelid::regclass::text IN ('vehicles', 'fixed_assets', 'amc_contracts', 'whatsapp_chats');
  `);
  console.log(JSON.stringify(rows, null, 2));

  await client.end();
}

run().catch(console.error);
