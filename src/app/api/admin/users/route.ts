import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { PermissionScope } from '@/types/rbac.types';

// Helper to authenticate the admin user
async function authenticateAdmin(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return { error: 'Missing authorization header', status: 401 };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return { error: 'Invalid authentication token', status: 401 };
  }

  // Check if user has active 'admin' role in user_roles
  const { data: userRoles, error: rolesError } = await supabaseAdmin
    .from('user_roles')
    .select('role:roles(role_key, is_active)')
    .eq('user_id', user.id);

  if (rolesError) {
    return { error: 'Failed to retrieve user roles', status: 500 };
  }

  const isAdmin = (userRoles || []).some(
    (ur: any) => ur.role?.role_key === 'admin' && ur.role?.is_active === true
  );

  if (!isAdmin) {
    return { error: 'Access denied: Administrative privileges required', status: 403 };
  }

  return { caller: user };
}

// GET: List all users with auth/session metadata (admin only)
export async function GET(req: Request) {
  try {
    const auth = await authenticateAdmin(req);
    if (auth.error || !auth.caller) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: auth.status || 401 });
    }

    // 1. Fetch all auth users (paginated — gather up to 1000)
    const { data: authData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 500 });
    }

    // 2. Fetch profiles and roles in parallel
    const [{ data: profiles }, { data: userRoles }] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, full_name, email, role'),
      supabaseAdmin.from('user_roles').select('user_id, role:roles(id, role_key, name, is_active)'),
    ]);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    const rolesMap = new Map<string, any[]>();
    for (const ur of userRoles || []) {
      if (!ur.user_id || !ur.role) continue;
      if (!rolesMap.has(ur.user_id)) rolesMap.set(ur.user_id, []);
      rolesMap.get(ur.user_id)!.push(ur.role);
    }

    const users = authData.users.map(u => {
      const profile = profileMap.get(u.id);
      const bannedUntil = (u as any).banned_until as string | null | undefined;
      const isBanned = !!bannedUntil && new Date(bannedUntil) > new Date();
      return {
        id: u.id,
        email: u.email,
        full_name: profile?.full_name || u.user_metadata?.full_name || '—',
        legacy_role: profile?.role || 'engineer',
        roles: rolesMap.get(u.id) || [],
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at || null,
        email_confirmed_at: u.email_confirmed_at || null,
        is_banned: isBanned,
        banned_until: isBanned ? bannedUntil : null,
      };
    });

    return NextResponse.json({ users });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a new user
export async function POST(req: Request) {
  try {
    const auth = await authenticateAdmin(req);
    if (auth.error || !auth.caller) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: auth.status || 401 });
    }
    const { caller } = auth;

    const { email, password, fullName, roleIds, department } = await req.json();

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Create User in Supabase Auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'engineer' // placeholder
      }
    });

    if (createError || !newUser.user) {
      return NextResponse.json({ error: createError?.message || 'Failed to create auth user' }, { status: 500 });
    }

    const userId = newUser.user.id;

    // 2. Clear auto-created profile to avoid conflict, or let the trigger do its work
    // The trigger public.handle_new_user automatically creates profiles row on auth.users insert.
    // Let's wait a tiny bit or write to it directly. We'll update the profile details.
    await new Promise(r => setTimeout(r, 100)); // Snappy wait for trigger execution

    // 3. Assign dynamic roles in user_roles
    if (roleIds && roleIds.length > 0) {
      const inserts = roleIds.map((roleId: string) => ({
        user_id: userId,
        role_id: roleId,
        assigned_by: caller.id,
        assigned_at: new Date().toISOString()
      }));

      const { error: roleErr } = await supabaseAdmin
        .from('user_roles')
        .insert(inserts);

      if (roleErr) {
        logger.error('Failed to insert user roles:', roleErr);
      }
    }

    // 4. Resolve highest role to update legacy profile role
    let legacyRole = 'engineer';
    if (roleIds && roleIds.length > 0) {
      const { data: loadedRoles } = await supabaseAdmin
        .from('roles')
        .select('*')
        .in('id', roleIds);

      if (loadedRoles && loadedRoles.length > 0) {
        let highestRole = loadedRoles[0];
        for (const r of loadedRoles) {
          if (r.hierarchy_level < highestRole.hierarchy_level) {
            highestRole = r;
          }
        }
        
        const key = highestRole.role_key;
        if (key === 'admin') legacyRole = 'admin';
        else if (key === 'pm' || key === 'gm' || key === 'commercial_mgr') legacyRole = 'manager';
        else if (key === 'accountant') legacyRole = 'account';
        else if (key === 'storekeeper') legacyRole = 'storekeeper';
        else legacyRole = 'engineer';
      }
    }

    // 5. Update profiles row
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: fullName,
        email: email,
        role: legacyRole,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileErr) {
      logger.error('Failed to update profile details:', profileErr);
    }

    // 6. Create employee profile if department is specified
    if (department) {
      const { error: empErr } = await supabaseAdmin
        .from('employees')
        .insert({
          user_id: userId,
          full_name_en: fullName,
          full_name_ar: '',
          nationality: 'Unknown',
          dob: '1990-01-01',
          gender: 'MALE',
          mobile: '0000000000',
          personal_email: email,
          designation: legacyRole.toUpperCase(),
          department: department,
          employment_type: 'FULL_TIME',
          join_date: new Date().toISOString().substring(0, 10),
          status: 'ACTIVE',
          passport_no: '00000000',
          passport_expiry: '2030-01-01',
          emirates_id_no: '000-0000-0000000-0',
          emirates_id_expiry: '2030-01-01',
          visa_no: '00000000',
          visa_expiry: '2030-01-01',
          labour_card_no: '00000000',
          labour_card_expiry: '2030-01-01',
          mohre_person_code: '00000000',
          medical_insurance_expiry: '2030-01-01',
          bank_name: 'Unknown Bank',
          iban: 'AE000000000000000000000',
          routing_code: '000000000',
          agent_id: '00000',
          is_active: true,
          created_by: caller.id
        });

      if (empErr) {
        logger.error('Failed to create employee card:', empErr);
      }
    }

    // 7. Log Forensic Audit Trail
    const hexKey = Array.from(userId)
      .map((c: any) => c.charCodeAt(0).toString(16))
      .join('')
      .padEnd(32, '0')
      .slice(0, 32);
    const uuidEntityId = `${hexKey.slice(0, 8)}-${hexKey.slice(8, 12)}-4${hexKey.slice(13, 16)}-a${hexKey.slice(17, 20)}-${hexKey.slice(20, 32)}`;

    await supabaseAdmin.from('audit_log').insert({
      action: 'CREATE',
      entity_type: 'USER_ACCOUNT',
      entity_id: uuidEntityId,
      entity_label: email,
      summary: `Created User Account: ${fullName} (${email}), Assigned Role: ${legacyRole}, Department: ${department || 'None'}`,
      actor_user_id: caller.id,
      actor_role: 'admin',
      module: 'SYSTEM',
      source: 'API'
    });

    return NextResponse.json({ success: true, userId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// PUT: Update user profile and roles
export async function PUT(req: Request) {
  try {
    const auth = await authenticateAdmin(req);
    if (auth.error || !auth.caller) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: auth.status || 401 });
    }
    const { caller } = auth;

    const { userId, email, fullName, roleIds, department } = await req.json();

    if (!userId || !email || !fullName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Update User in Supabase Auth
    const { error: updateAuthErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email,
      user_metadata: {
        full_name: fullName
      }
    });

    if (updateAuthErr) {
      return NextResponse.json({ error: updateAuthErr.message }, { status: 500 });
    }

    // 2. Reassign roles in user_roles
    const { error: delError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    if (delError) {
      return NextResponse.json({ error: delError.message }, { status: 500 });
    }

    if (roleIds && roleIds.length > 0) {
      const inserts = roleIds.map((roleId: string) => ({
        user_id: userId,
        role_id: roleId,
        assigned_by: caller.id,
        assigned_at: new Date().toISOString()
      }));

      const { error: insError } = await supabaseAdmin
        .from('user_roles')
        .insert(inserts);

      if (insError) {
        return NextResponse.json({ error: insError.message }, { status: 500 });
      }
    }

    // 3. Resolve highest role key to update legacy profile role column
    let legacyRole = 'engineer';
    if (roleIds && roleIds.length > 0) {
      const { data: loadedRoles } = await supabaseAdmin
        .from('roles')
        .select('*')
        .in('id', roleIds);

      if (loadedRoles && loadedRoles.length > 0) {
        let highestRole = loadedRoles[0];
        for (const r of loadedRoles) {
          if (r.hierarchy_level < highestRole.hierarchy_level) {
            highestRole = r;
          }
        }
        
        const key = highestRole.role_key;
        if (key === 'admin') legacyRole = 'admin';
        else if (key === 'pm' || key === 'gm' || key === 'commercial_mgr') legacyRole = 'manager';
        else if (key === 'accountant') legacyRole = 'account';
        else if (key === 'storekeeper') legacyRole = 'storekeeper';
        else legacyRole = 'engineer';
      }
    }

    // 4. Update profile details
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: fullName,
        email: email,
        role: legacyRole,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    // 5. Update employees row if link exists
    if (department) {
      // Check if employee card exists
      const { data: existingEmp } = await supabaseAdmin
        .from('employees')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingEmp) {
        await supabaseAdmin
          .from('employees')
          .update({
            full_name_en: fullName,
            personal_email: email,
            department: department,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingEmp.id);
      } else {
        // Create dynamic new employee card
        await supabaseAdmin
          .from('employees')
          .insert({
            user_id: userId,
            full_name_en: fullName,
            full_name_ar: '',
            nationality: 'Unknown',
            dob: '1990-01-01',
            gender: 'MALE',
            mobile: '0000000000',
            personal_email: email,
            designation: legacyRole.toUpperCase(),
            department: department,
            employment_type: 'FULL_TIME',
            join_date: new Date().toISOString().substring(0, 10),
            status: 'ACTIVE',
            passport_no: '00000000',
            passport_expiry: '2030-01-01',
            emirates_id_no: '000-0000-0000000-0',
            emirates_id_expiry: '2030-01-01',
            visa_no: '00000000',
            visa_expiry: '2030-01-01',
            labour_card_no: '00000000',
            labour_card_expiry: '2030-01-01',
            mohre_person_code: '00000000',
            medical_insurance_expiry: '2030-01-01',
            bank_name: 'Unknown Bank',
            iban: 'AE000000000000000000000',
            routing_code: '000000000',
            agent_id: '00000',
            is_active: true,
            created_by: caller.id
          });
      }
    }

    // 6. Record Audit
    const hexKey = Array.from(userId)
      .map((c: any) => c.charCodeAt(0).toString(16))
      .join('')
      .padEnd(32, '0')
      .slice(0, 32);
    const uuidEntityId = `${hexKey.slice(0, 8)}-${hexKey.slice(8, 12)}-4${hexKey.slice(13, 16)}-a${hexKey.slice(17, 20)}-${hexKey.slice(20, 32)}`;

    await supabaseAdmin.from('audit_log').insert({
      action: 'UPDATE',
      entity_type: 'USER_ACCOUNT',
      entity_id: uuidEntityId,
      entity_label: email,
      summary: `Updated User Account: ${fullName} (${email}), Legacy Role: ${legacyRole}, Department: ${department || 'None'}`,
      actor_user_id: caller.id,
      actor_role: 'admin',
      module: 'SYSTEM',
      source: 'API'
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Terminate user account
export async function DELETE(req: Request) {
  try {
    const auth = await authenticateAdmin(req);
    if (auth.error || !auth.caller) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: auth.status || 401 });
    }
    const { caller } = auth;

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    // Fetch details before delete for logging
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .maybeSingle();

    const userName = profile?.full_name || 'Unknown User';
    const userEmail = profile?.email || 'Unknown Email';

    // 1. Delete employee profile link
    await supabaseAdmin.from('employees').delete().eq('user_id', userId);

    // 2. Delete user from auth
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    // 3. Record Audit
    const hexKey = Array.from(userId)
      .map((c: any) => c.charCodeAt(0).toString(16))
      .join('')
      .padEnd(32, '0')
      .slice(0, 32);
    const uuidEntityId = `${hexKey.slice(0, 8)}-${hexKey.slice(8, 12)}-4${hexKey.slice(13, 16)}-a${hexKey.slice(17, 20)}-${hexKey.slice(20, 32)}`;

    await supabaseAdmin.from('audit_log').insert({
      action: 'DELETE',
      entity_type: 'USER_ACCOUNT',
      entity_id: uuidEntityId,
      entity_label: userEmail,
      summary: `Permanently Deleted User Account: ${userName} (${userEmail})`,
      actor_user_id: caller.id,
      actor_role: 'admin',
      module: 'SYSTEM',
      source: 'API'
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
