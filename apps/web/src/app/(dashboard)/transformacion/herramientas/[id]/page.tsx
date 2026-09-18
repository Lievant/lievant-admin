import {
  getTool,
  getToolOptions,
  listEmployees,
  type EmployeeListItem,
  type ToolOptions,
} from '@/lib/api';
import { ToolDetailScreen } from './tool-detail-screen';

interface ToolDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ToolDetailPage({ params }: ToolDetailPageProps) {
  const { id } = await params;

  const tool = await getTool(id);

  // El picker de asignación necesita la plantilla activa. Si falla, el detalle
  // se muestra igual y solo se pierde el alta de asignaciones.
  let employees: EmployeeListItem[] = [];
  try {
    const page = await listEmployees({ status: 'active', limit: 500 });
    employees = page.data;
  } catch {
    employees = [];
  }

  let options: ToolOptions | null = null;
  try {
    options = await getToolOptions();
  } catch {
    options = null;
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <ToolDetailScreen tool={tool} employees={employees} options={options} />
    </div>
  );
}
