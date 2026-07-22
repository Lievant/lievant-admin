import { DashboardScreen } from '@/components/dashboard/dashboard-screen';
import {
  getCurrentUser,
  getEmployeeDashboard,
  listAnnouncements,
  type Announcement,
  type CurrentUser,
  type DashboardData,
} from '@/lib/api';

export default async function DashboardPage() {
  let user: CurrentUser | null = null;
  let dashboardData: DashboardData | null = null;
  let announcements: Announcement[] = [];

  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }

  await Promise.allSettled([
    getEmployeeDashboard()
      .then((d) => { dashboardData = d; })
      .catch(() => {}),
    listAnnouncements()
      .then((a) => { announcements = a; })
      .catch(() => {}),
  ]);

  return (
    <DashboardScreen
      user={user}
      dashboardData={dashboardData}
      announcements={announcements}
    />
  );
}
