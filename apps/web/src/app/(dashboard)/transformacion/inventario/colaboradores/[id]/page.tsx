import { EmployeeEquipmentScreen } from './employee-equipment-screen';

export default async function ColaboradorEquipoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EmployeeEquipmentScreen employeeId={id} />;
}
