import { getMissingDocumentsReport } from '@/lib/api';
import { MissingDocsReportScreen } from './missing-docs-report-screen';

async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

export default async function DocumentosFaltantesPage() {
  const items = await safe(getMissingDocumentsReport());

  return <MissingDocsReportScreen items={items ?? []} />;
}
