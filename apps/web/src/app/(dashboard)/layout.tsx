import { IdleLogout } from '@/components/idle-logout';
import { Sidebar } from '@/components/sidebar';
import { getCurrentUser, type CurrentUser } from '@/lib/api';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let user: CurrentUser | null = null;

  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <IdleLogout />
      <Sidebar user={user} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
