import { errorKindOf, getAnalyticsSummary, type AnalyticsSummary, type ErrorKind } from '@/lib/api';
import { AnalyticsScreen } from './analytics-screen';

const EMPTY: AnalyticsSummary = {
  period: { from: '', to: '' },
  totalUsers: 0,
  activeUsers: 0,
  totalSessions: 0,
  avgSessionMinutes: 0,
  totalActions: 0,
  topUsers: [],
  leastActiveUsers: [],
  byModule: [],
  byDepartment: [],
  errorRate: { total: 0, percent: 0, byModule: [], criticalUnresolved: 0 },
  activityTimeline: [],
  moduleHeatmap: [],
};

export default async function AnalyticsPage() {
  let summary: AnalyticsSummary | null = null;
  let errorKind: ErrorKind | null = null;
  try {
    summary = await getAnalyticsSummary();
  } catch (err) {
    errorKind = errorKindOf(err);
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <AnalyticsScreen initial={summary ?? EMPTY} errorKind={errorKind} />
    </div>
  );
}
