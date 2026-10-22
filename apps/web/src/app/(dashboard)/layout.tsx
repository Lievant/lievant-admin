import { ApiHealthBanner } from '@/components/api-health-banner';
import { IdleLogout } from '@/components/idle-logout';
import { DashboardShell } from '@/components/dashboard-shell';
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
        <DashboardShell user={user}>{children}</DashboardShell>
      </UserProvider>
    </div>
  );
}
