import pg from 'pg';
const { Client } = pg;

const rawUrl = 'postgresql://postgres.renqeeaabnqoikhvczww@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
const password = 'AzadSali4347';
const connectionString = rawUrl.replace('postgres.renqeeaabnqoikhvczww@', `postgres.renqeeaabnqoikhvczww:${password}@`);

async function inspectColumns() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected!');

  const tables = ['purchase_orders', 'whatsapp_chats', 'service_tickets', 'meetings', 'tasks'];
  for (const table of tables) {
    const { rows } = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1;
    `, [table]);
    console.log(`\nTable: ${table}`);
    console.log(rows.map(r => `  - ${r.column_name} (${r.data_type})`).join('\n'));
  }

  await client.end();
}

inspectColumns().catch(console.error);
