import pg from 'pg';
const { Client } = pg;

const rawUrl = 'postgresql://postgres.renqeeaabnqoikhvczww@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
const password = 'AzadSali4347';
const connectionString = rawUrl.replace('postgres.renqeeaabnqoikhvczww@', `postgres.renqeeaabnqoikhvczww:${password}@`);

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected!');

  const { rows: columns } = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'vehicles';
  `);
  console.log('Columns:');
  console.log(columns.map(c => `  - ${c.column_name} (${c.data_type})`).join('\n'));

  // Also query constraints on vehicles
  const { rows: constraints } = await client.query(`
    SELECT 
        conname AS constraint_name, 
        conrelid::regclass AS table_name, 
        confrelid::regclass AS foreign_table_name,
        pg_get_constraintdef(oid) AS constraint_def
    FROM 
        pg_constraint 
    WHERE 
        conrelid::regclass::text = 'vehicles';
  `);
  console.log('\nConstraints:');
  console.log(JSON.stringify(constraints, null, 2));

  await client.end();
}

run().catch(console.error);
