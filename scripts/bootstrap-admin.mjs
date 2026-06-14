// One-time bootstrap: ensure Mosbah Rama (ramma.mosbah@gmail.com) exists as full admin.
// Usage: node scripts/bootstrap-admin.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import crypto from 'crypto';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const ADMIN_EMAIL = 'ramma.mosbah@gmail.com';
const ADMIN_NAME = 'Mosbah Rama';

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  // 1. Find or create the auth user
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) throw listErr;

  let user = list.users.find(u => u.email?.toLowerCase() === ADMIN_EMAIL);
  let tempPassword = null;

  if (!user) {
    tempPassword = 'Jeet-' + crypto.randomBytes(6).toString('base64url') + '!9';
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: ADMIN_NAME, role: 'admin' },
    });
    if (createErr) throw createErr;
    user = created.user;
    console.log(`Created new auth user: ${user.id}`);
    await new Promise(r => setTimeout(r, 300)); // wait for handle_new_user trigger
  } else {
    console.log(`User already exists: ${user.id}`);
    const { error: updErr } = await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true,
      user_metadata: { ...user.user_metadata, full_name: ADMIN_NAME, role: 'admin' },
    });
    if (updErr) console.warn('Metadata update warning:', updErr.message);
  }

  // 2. Upsert profile
  const { error: profErr } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      full_name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      role: 'admin',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (profErr) throw profErr;
  console.log('Profile set: full_name="' + ADMIN_NAME + '", role=admin');

  // 3. Find admin role and assign
  const { data: roles, error: rolesErr } = await supabase
    .from('roles')
    .select('id, role_key, name, is_active')
    .eq('role_key', 'admin');
  if (rolesErr) throw rolesErr;

  if (!roles || roles.length === 0) {
    console.warn('WARNING: no "admin" role found in roles table — RBAC role not assigned. Legacy profiles.role=admin is set.');
  } else {
    const adminRole = roles[0];
    if (!adminRole.is_active) {
      await supabase.from('roles').update({ is_active: true }).eq('id', adminRole.id);
      console.log('Re-activated admin role.');
    }
    const { data: existing } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', user.id)
      .eq('role_id', adminRole.id)
      .maybeSingle();

    if (!existing) {
      const { error: urErr } = await supabase.from('user_roles').insert({
        user_id: user.id,
        role_id: adminRole.id,
        assigned_at: new Date().toISOString(),
      });
      if (urErr) throw urErr;
      console.log(`Assigned RBAC role: ${adminRole.name} (${adminRole.role_key})`);
    } else {
      console.log('RBAC admin role already assigned.');
    }
  }

  console.log('---');
  console.log('DONE. Account ready:');
  console.log(`  Name:  ${ADMIN_NAME}`);
  console.log(`  Email: ${ADMIN_EMAIL}`);
  if (tempPassword) {
    console.log(`  Temporary password: ${tempPassword}`);
    console.log('  CHANGE THIS PASSWORD after first sign-in.');
  } else {
    console.log('  Password: unchanged (existing account)');
  }
}

main().catch(e => {
  console.error('FAILED:', e.message || e);
  process.exit(1);
});
