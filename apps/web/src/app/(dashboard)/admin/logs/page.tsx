import { errorKindOf, listAuditConfig, type ErrorKind } from '@/lib/api';
import { LogsScreen } from './logs-screen';

/**
 * El contenido de cada tab lo carga el cliente al vuelo, porque depende de
 * filtros que cambian sin recargar. Aquí solo se sondea el permiso: si el API
 * responde 403, la pantalla muestra NoPermissions en vez de tablas vacías.
 */
export default async function LogsPage() {
  let errorKind: ErrorKind | null = null;
  try {
    await listAuditConfig();
  } catch (err) {
    errorKind = errorKindOf(err);
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <LogsScreen errorKind={errorKind} />
    </div>
  );
}
