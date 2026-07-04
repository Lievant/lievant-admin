import { notFound } from 'next/navigation';
import { getEmployeeLicense, listLicenseTools } from '@/lib/api';
import { EmployeeLicensesScreen } from './employee-licenses-screen';

interface EmployeeLicensesPageProps {
  params: Promise<{ employeeId: string }>;
}

export default async function EmployeeLicensesPage({ params }: EmployeeLicensesPageProps) {
  const { employeeId } = await params;

  const [detail, tools] = await Promise.all([
    getEmployeeLicense(employeeId).catch(() => null),
    listLicenseTools().catch(() => []),
  ]);

  if (!detail) notFound();

  return (
    <div className="mx-auto max-w-screen-lg px-6 py-8">
      <EmployeeLicensesScreen detail={detail} tools={tools} />
    </div>
  );
}
