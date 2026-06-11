import fs from 'fs';

const report = JSON.parse(fs.readFileSync('temp_tests/db_report.json', 'utf8'));

const targetTables = ['service_tickets', 'meetings', 'purchase_orders', 'whatsapp_chats', 'tasks', 'user_roles', 'roles', 'tc_test_results', 'vehicles', 'vehicle_assignments', 'fuel_logs', 'vehicle_fines'];

console.log('--- Analyze Target Tables and Foreign Keys ---');
for (const table of targetTables) {
  console.log(`\nTable: ${table}`);
  const fks = report.foreignKeys.filter(fk => fk.table_name === table);
  if (fks.length === 0) {
    console.log('  No foreign keys found.');
  } else {
    for (const fk of fks) {
      console.log(`  - ${fk.column_name} -> ${fk.foreign_table_name}(${fk.foreign_column_name}) [${fk.constraint_name}]`);
    }
  }
}
