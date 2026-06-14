// The Executive Finance Dashboard is merged into the Finance Hub
// ("Financial Operations Command") at /finance. This route redirects
// there so existing links/bookmarks keep working.
import { redirect } from 'next/navigation';

export default function ExecutiveDashboardRedirect() {
  redirect('/finance');
}
