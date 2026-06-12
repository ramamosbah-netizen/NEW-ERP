import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Authenticate that the caller holds an active admin role
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

async function recordAudit(callerId: string, action: string, targetEmail: string, summary: string) {
  await supabaseAdmin.from('audit_log').insert({
    action,
    entity_type: 'USER_SESSION',
    entity_id: '00000000-0000-4000-a000-000000000000',
    entity_label: targetEmail,
    summary,
    actor_user_id: callerId,
    actor_role: 'admin',
    module: 'SYSTEM',
    source: 'API',
  });
}

// POST: Session management actions — signout | ban | unban
export async function POST(req: Request) {
  try {
    const auth = await authenticateAdmin(req);
    if (auth.error || !auth.caller) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: auth.status || 401 });
    }
    const { caller } = auth;

    const { userId, action, banHours } = await req.json();

    if (!userId || !action) {
      return NextResponse.json({ error: 'Missing userId or action' }, { status: 400 });
    }

    if (userId === caller.id && (action === 'ban' || action === 'signout')) {
      return NextResponse.json({ error: 'You cannot ban or sign out your own account' }, { status: 400 });
    }

    // Resolve target user for audit labels
    const { data: target } = await supabaseAdmin.auth.admin.getUserById(userId);
    const targetEmail = target?.user?.email || userId;

    if (action === 'signout') {
      // Revoke all refresh tokens via the GoTrue admin logout endpoint.
      // Existing access tokens remain valid until expiry (max ~1h), after which
      // the user is forced to re-authenticate.
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${userId}/logout`,
        {
          method: 'POST',
          headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          },
        }
      );

      if (!res.ok && res.status !== 204) {
        const body = await res.text();
        return NextResponse.json({ error: `Failed to revoke sessions: ${body}` }, { status: 500 });
      }

      await recordAudit(caller.id, 'UPDATE', targetEmail, `Force signed-out all sessions for: ${targetEmail}`);
      return NextResponse.json({ success: true, message: 'All sessions revoked' });
    }

    if (action === 'ban') {
      const hours = Number(banHours) > 0 ? Number(banHours) : 876600; // default ≈ 100 years
      const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: `${hours}h`,
      });

      if (banErr) {
        return NextResponse.json({ error: banErr.message }, { status: 500 });
      }

      await recordAudit(caller.id, 'UPDATE', targetEmail, `Banned account ${targetEmail} for ${hours}h`);
      return NextResponse.json({ success: true, message: 'User banned' });
    }

    if (action === 'unban') {
      const { error: unbanErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: 'none',
      });

      if (unbanErr) {
        return NextResponse.json({ error: unbanErr.message }, { status: 500 });
      }

      await recordAudit(caller.id, 'UPDATE', targetEmail, `Unbanned account: ${targetEmail}`);
      return NextResponse.json({ success: true, message: 'User unbanned' });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
