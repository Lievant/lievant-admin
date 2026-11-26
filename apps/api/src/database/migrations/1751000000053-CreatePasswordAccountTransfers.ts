import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * TIC-RE-17: historial de transferencias de cuentas entre colaboradores.
 *
 *  - `passwords.account_transfers`: una fila por transferencia, con nombres en snapshot (de quién, a quién y quién
 *    la hizo) para que el historial no cambie si después se edita o se da de baja un expediente. Solo inserción:
 *    no hay endpoint para editar ni borrar filas.
 *  - Índice por (account_id, created_at DESC): el historial de una cuenta se lee del más reciente al más antiguo.
 *
 * No agrega permisos: el control de acceso (dueño, jefe directo actual o SUPER_ADMIN) vive en el servicio.
 * Aditiva e idempotente. DESPLIEGUE: primero esta migración y después el código. `down()` borra la tabla y su
 * historial.
 */
export class CreatePasswordAccountTransfers1751000000053 implements MigrationInterface {
  name = 'CreatePasswordAccountTransfers1751000000053';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS passwords.account_transfers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES passwords.account_passwords(id),
        from_employee_id UUID NOT NULL REFERENCES employees.employee_records(id),
        to_employee_id UUID NOT NULL REFERENCES employees.employee_records(id),
        from_employee_name VARCHAR(200) NOT NULL,
        to_employee_name VARCHAR(200) NOT NULL,
        transferred_by UUID REFERENCES auth.users(id),
        transferred_by_name VARCHAR(200) NOT NULL,
        reason VARCHAR(300),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_account_transfers_account_created
        ON passwords.account_transfers (account_id, created_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS passwords.idx_account_transfers_account_created`);
    await queryRunner.query(`DROP TABLE IF EXISTS passwords.account_transfers`);
  }
}
