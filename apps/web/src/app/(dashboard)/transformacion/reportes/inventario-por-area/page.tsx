import { getInventoryReportByArea } from '@/lib/api';
import { InventoryAreaReportScreen } from './inventory-area-report-screen';

export default async function InventarioPorAreaPage() {
  let report = null;
  let error = false;

  try {
    report = await getInventoryReportByArea();
  } catch {
    error = true;
  }

  return <InventoryAreaReportScreen report={report} error={error} />;
}
