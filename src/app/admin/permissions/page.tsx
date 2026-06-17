// Merged into /admin/access (Permissions Matrix tab). Kept as a redirect so
// existing links, bookmarks and deep links keep working.
import { redirect } from 'next/navigation';

export default function PermissionsRedirect() {
  redirect('/admin/access?tab=permissions');
}
