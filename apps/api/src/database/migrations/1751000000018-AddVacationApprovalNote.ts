import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Nota del jefe al aprobar unas vacaciones.
 *
 * Hasta ahora solo el rechazo dejaba texto (`rejection_reason`), así que el
 * modal de detalle mostraba "Sin nota" en toda solicitud aprobada: no había
 * dónde guardarla. La aprobación es justo el momento en el que el jefe suele
 * añadir condiciones ("de acuerdo, pero deja el traspaso al día"), y ese
 * contexto se perdía.
 *
 * Columna aparte y no reutilizar `rejection_reason`: el nombre miente para una
 * aprobación, y separarlas deja que una solicitud rechazada conserve su motivo
 * si alguien la reabriera más adelante.
 *
 * Nullable y sin backfill: las aprobaciones anteriores nunca capturaron nota y
 * no hay de dónde reconstruirla.
 */
export class AddVacationApprovalNote1751000000018 implements MigrationInterface {
  name = 'AddVacationApprovalNote1751000000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE hr.vacation_requests
      ADD COLUMN IF NOT EXISTS approval_note TEXT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE hr.vacation_requests
      DROP COLUMN IF EXISTS approval_note
    `);
  }
}
