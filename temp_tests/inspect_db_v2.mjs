import pg from 'pg';
import fs from 'fs';
const { Client } = pg;

const rawUrl = 'postgresql://postgres.renqeeaabnqoikhvczww@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
const password = 'AzadSali4347';
const connectionString = rawUrl.replace('postgres.renqeeaabnqoikhvczww@', `postgres.renqeeaabnqoikhvczww:${password}@`);

async function inspect() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to Database successfully!');

  // Query all public tables
  const { rows: tables } = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  // Query all foreign keys
  const { rows: fks } = await client.query(`
    SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name;
  `);

  // Let's check policies
  const { rows: policies } = await client.query(`
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `);

  const report = {
    tables: tables.map(t => t.table_name),
    foreignKeys: fks,
    policies: policies
  };
  fs.writeFileSync('temp_tests/db_report.json', JSON.stringify(report, null, 2));
  console.log('✅ DB inspection report written to temp_tests/db_report.json!');

  await client.end();
}

inspect().catch(console.error);
