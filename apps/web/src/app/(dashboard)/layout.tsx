import { ApiHealthBanner } from '@/components/api-health-banner';
import { IdleLogout } from '@/components/idle-logout';
import { Sidebar } from '@/components/sidebar';
import { UserProvider } from '@/components/user-provider';
import { getCurrentUser, type CurrentUser } from '@/lib/api';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let user: CurrentUser | null = null;

  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <ApiHealthBanner />
      <IdleLogout />
      <UserProvider user={user}>
        <Sidebar user={user} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </UserProvider>
    </div>
  );
}
