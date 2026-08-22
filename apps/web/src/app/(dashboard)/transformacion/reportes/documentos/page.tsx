import { errorKindOf, getDocumentReportSummary, type DocumentSummary, type ErrorKind } from '@/lib/api';
import { DocumentStatusReportScreen } from './document-status-report-screen';

export default async function ControlDocumentosPage() {
  let summary: DocumentSummary | null = null;
  let errorKind: ErrorKind | null = null;

  try {
    summary = await getDocumentReportSummary();
  } catch (err) {
    errorKind = errorKindOf(err);
  }

  return <DocumentStatusReportScreen summary={summary} errorKind={errorKind} />;
}
