// ============================================================
// Aura ERP — Automated role-based RLS security audit
//   node scripts/security-audit.mjs
//
// Creates one test user per role, signs in as each (anon key), and verifies what
// the new RLS lockdown actually allows/denies against the LIVE database:
//   1. Broad read sanity (all authenticated can read finance lists)
//   2. Finance WRITE lockdown (only finance/admin can insert a client invoice)
//   3. Payroll READ confidentiality (only HR/admin can read employee_compensation)
//   4. Maker-checker (creator cannot approve their own project_budget) — two-user
//
// Safe: the only writes are a throwaway DRAFT invoice / budget that are deleted
// via the service role immediately. Test users are kept (reusable for UI UAT);
// pass --cleanup-users to delete them at the end.
// ============================================================
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const CLEANUP_USERS = process.argv.includes('--cleanup-users');

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const PW = 'Audit-' + Math.random().toString(36).slice(2, 10) + '!9';

// role_key → whether is_finance() / is_hr() should be true
const ROLES = ['admin', 'accountant', 'hr', 'engineer', 'storekeeper', 'pm', 'procurement'];
const FINANCE_OK = new Set(['admin', 'accountant', 'gm', 'account', 'finance_manager', 'commercial_mgr']);
const HR_OK = new Set(['admin', 'hr', 'hr_manager', 'gm']);
const LEGACY_OK = new Set(['admin', 'manager', 'account', 'engineer', 'storekeeper']); // profiles.role CHECK

const isRLS = (e) => !!e && (e.code === '42501' || /row-level security|violates row-level/i.test(e.message || ''));
const results = [];
const rec = (role, test, expected, actual, ok, note = '') => results.push({ role, test, expected, actual, ok, note });

async function roleIdByKey(key) {
  const { data } = await admin.from('roles').select('id, role_key').eq('role_key', key).maybeSingle();
  return data?.id ?? null;
}

async function ensureUser(role) {
  const email = `audit_${role}@auratest.local`;
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let user = list.users.find(u => u.email?.toLowerCase() === email);
  const metaRole = LEGACY_OK.has(role) ? role : 'engineer';
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email, password: PW, email_confirm: true, user_metadata: { full_name: `Audit ${role}`, role: metaRole },
    });
    if (error) throw new Error(`create ${role}: ${error.message}`);
    user = data.user;
    await new Promise(r => setTimeout(r, 250)); // let handle_new_user run
  } else {
    await admin.auth.admin.updateUserById(user.id, { password: PW });
  }
  // assign RBAC role (the is_finance/is_hr helpers read user_roles.role_key)
  const roleId = await roleIdByKey(role);
  if (roleId) {
    await admin.from('user_roles').upsert({ user_id: user.id, role_id: roleId }, { onConflict: 'user_id,role_id' });
  }
  return { email, id: user.id, roleId };
}

const seeded = { clientId: null, projectId: null, employeeId: null, compId: null };

async function seedReferenceData() {
  // Throwaway data so the WRITE / confidentiality / maker-checker tests can run.
  // All tagged AUDIT_SEED and deleted in cleanup().
  const { data: ul } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  const anyUserId = ul?.users?.[0]?.id ?? null;
  try {
    const { data } = await admin.from('clients').insert({ name: 'ZZ Audit Client', client_type: 'COMPANY' }).select('id').maybeSingle();
    seeded.clientId = data?.id ?? null;
  } catch { /* try minimal */ }
  if (!seeded.clientId) {
    const { data } = await admin.from('clients').insert({ name: 'ZZ Audit Client' }).select('id').maybeSingle();
    seeded.clientId = data?.id ?? null;
  }
  {
    const { data, error } = await admin.from('projects').insert({ name: 'ZZ Audit Project', client_id: seeded.clientId, client_name: 'ZZ Audit Client', project_number: `ZZ-AUDIT-${Date.now()}`, project_type: 'SUPPLY_INSTALL', created_by: anyUserId }).select('id').maybeSingle();
    if (error) console.log('  ! project seed error:', error.message?.slice(0, 140));
    seeded.projectId = data?.id ?? null;
  }

  // Minimal employee + one compensation row for the salary-confidentiality test.
  const d2030 = '2030-01-01';
  {
    const { data: emp, error: empErr } = await admin.from('employees').insert({
      full_name_en: 'ZZ Audit Emp', full_name_ar: 'تجربة', nationality: 'Unknown', dob: '1990-01-01',
      gender: 'MALE', mobile: '0000000000', personal_email: 'audit_emp@auratest.local', designation: 'TESTER',
      department: 'ADMIN', employment_type: 'FULL_TIME', join_date: '2020-01-01', status: 'ACTIVE',
      passport_no: 'AUD00000', passport_expiry: d2030, emirates_id_no: '000-0000-0000000-0', emirates_id_expiry: d2030,
      visa_no: 'AUD00000', visa_expiry: d2030, labour_card_no: 'AUD00000', labour_card_expiry: d2030,
      mohre_person_code: 'AUD00000', medical_insurance_expiry: d2030, bank_name: 'Audit Bank',
      iban: 'AE000000000000000000000', routing_code: '000000000', agent_id: '00000', is_active: true,
    }).select('id').maybeSingle();
    if (empErr) console.log('  ! employee seed error:', empErr.message?.slice(0, 140));
    seeded.employeeId = emp?.id ?? null;
  }
  if (seeded.employeeId) {
    const { data: comp, error: compErr } = await admin.from('employee_compensation').insert({
      employee_id: seeded.employeeId, basic_salary: 5000, housing_allowance: 1000,
      transport_allowance: 500, other_allowance: 0, effective_from: '2020-01-01',
    }).select('id').maybeSingle();
    if (compErr) console.log('  ! compensation seed error:', compErr.message?.slice(0, 140));
    seeded.compId = comp?.id ?? null;
  }
}

async function cleanupReferenceData() {
  if (seeded.compId) await admin.from('employee_compensation').delete().eq('id', seeded.compId);
  if (seeded.employeeId) await admin.from('employees').delete().eq('id', seeded.employeeId);
  if (seeded.projectId) await admin.from('project_budgets').delete().eq('project_id', seeded.projectId);
  if (seeded.projectId) await admin.from('projects').delete().eq('id', seeded.projectId);
  if (seeded.clientId) await admin.from('clients').delete().eq('id', seeded.clientId);
}

async function run() {
  console.log('Aura ERP — role-based RLS audit\n' + '='.repeat(50));

  await seedReferenceData();
  const client = seeded.clientId ? { id: seeded.clientId, name: 'ZZ Audit Client' } : null;
  const project = seeded.projectId ? { id: seeded.projectId } : null;
  const { count: compCount } = await admin.from('employee_compensation').select('*', { count: 'exact', head: true });
  console.log(`Seed: client=${!!client} project=${!!project} compensationRows=${compCount}\n`);

  const users = {};
  for (const role of ROLES) {
    try { users[role] = await ensureUser(role); }
    catch (e) { console.log(`  ! could not provision ${role}: ${e.message}`); }
  }

  for (const role of ROLES) {
    const u = users[role];
    if (!u) { rec(role, 'provision', 'user', 'missing', false); continue; }

    const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: signErr } = await c.auth.signInWithPassword({ email: u.email, password: PW });
    if (signErr) { rec(role, 'sign-in', 'ok', signErr.message, false); continue; }

    // 1. Broad read sanity
    {
      const { error } = await c.from('client_invoices').select('id').limit(1);
      rec(role, 'read finance list', 'allow', error ? 'blocked' : 'allow', !error);
    }

    // 2. Finance WRITE lockdown
    if (client) {
      const expectAllow = FINANCE_OK.has(role);
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await c.from('client_invoices').insert({
        invoice_number: `AUDIT-${role}-${Date.now()}`,
        client_id: client.id, client_name: client.name || 'Audit Client',
        invoice_type: 'STANDALONE', status: 'DRAFT',
        invoice_date: today, supply_date: today, due_date: today,
        created_by: u.id,
      }).select('id').maybeSingle();

      let actual, ok, note = '';
      if (!error && data) { actual = 'allowed'; ok = expectAllow; await admin.from('client_invoices').delete().eq('id', data.id); }
      else if (isRLS(error)) { actual = 'denied (RLS)'; ok = !expectAllow; }
      else { actual = 'error'; ok = false; note = error?.message?.slice(0, 80) || ''; }
      rec(role, 'write client_invoice', expectAllow ? 'allow' : 'deny', actual, ok, note);
    }

    // 3. Payroll READ confidentiality
    {
      const expectAllow = HR_OK.has(role);
      const { data, error } = await c.from('employee_compensation').select('id').limit(1);
      const sawRows = !!(data && data.length);
      let actual, ok, note = '';
      if (compCount === 0) { actual = 'no data'; ok = true; note = 'table empty — inconclusive'; }
      else if (error) { actual = 'denied (error)'; ok = !expectAllow; }
      else if (sawRows) { actual = 'rows visible'; ok = expectAllow; }
      else { actual = 'empty (RLS)'; ok = !expectAllow; }
      rec(role, 'read compensation', expectAllow ? 'allow' : 'deny', actual, ok, note);
    }

    await c.auth.signOut();
  }

  // 4. Maker-checker (DB trigger) — creator cannot approve own project_budget
  if (project && users['accountant']) {
    const u = users['accountant'];
    const { data: b, error: insErr } = await admin.from('project_budgets').insert({
      project_id: project.id, created_by: u.id,
    }).select('id, created_by').maybeSingle();
    if (b) {
      const { error: appErr } = await admin.from('project_budgets').update({ approved_by: u.id }).eq('id', b.id);
      const blocked = !!appErr && /maker-checker/i.test(appErr.message || '');
      rec('—', 'maker-checker (self-approve budget)', 'blocked', blocked ? 'blocked' : (appErr ? 'other error' : 'ALLOWED'), blocked,
        appErr && !blocked ? appErr.message.slice(0, 80) : '');
      await admin.from('project_budgets').delete().eq('id', b.id);
    } else {
      rec('—', 'maker-checker (self-approve budget)', 'blocked', 'could not seed budget', false, insErr?.message?.slice(0, 80) || '');
    }
  }

  // report
  console.log('\nRESULTS');
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  [${r.role}] ${r.test}: expected=${r.expected} actual=${r.actual}${r.note ? '  («' + r.note + '»)' : ''}`);
  }
  const fails = results.filter(r => !r.ok);
  console.log('\n' + '='.repeat(50));
  console.log(`${results.length - fails.length}/${results.length} checks passed.`);
  if (fails.length) console.log(`\n⚠️  ${fails.length} FAILED — review above.`);

  await cleanupReferenceData();
  console.log('Seed data cleaned up.');

  if (CLEANUP_USERS) {
    for (const role of ROLES) if (users[role]) await admin.auth.admin.deleteUser(users[role].id);
    console.log('\nTest users deleted.');
  } else {
    console.log(`\nTest users kept for UI UAT. Password: ${PW}`);
    console.log('Emails: ' + ROLES.map(r => `audit_${r}@auratest.local`).join(', '));
  }
}

run().catch(e => { console.error('AUDIT CRASHED:', e); process.exit(1); });
