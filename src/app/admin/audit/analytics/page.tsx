// Merged into /admin/audit (Analytics tab). Kept as a redirect so existing
// links, bookmarks and deep links keep working.
import { redirect } from 'next/navigation';

export default function AuditAnalyticsRedirect() {
  redirect('/admin/audit?tab=analytics');
}
