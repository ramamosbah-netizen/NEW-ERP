// Merged into /admin/audit (Configuration tab). Kept as a redirect so existing
// links, bookmarks and deep links keep working.
import { redirect } from 'next/navigation';

export default function ConfigurationRedirect() {
  redirect('/admin/audit?tab=configuration');
}
