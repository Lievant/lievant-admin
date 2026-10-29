import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Matriz de Puestos: «Reporta a» ligado a un empleado.
 *
 * `hr.job_positions.reports_to_employee_id` (FK a `employees.employee_records`, nulable, con índice). El texto que
 * venía del Excel sigue en `reports_to_text`, que NO se toca ni se borra; la importación nunca escribe la columna
 * nueva. «Supervisa a» deja de usarse en pantallas e importación, pero su columna y sus datos se conservan.
 *
 * Aditiva e idempotente; `down()` quita el índice y la columna.
 */
export class JobPositionReportsToEmployee1751000000044 implements MigrationInterface {
  name = 'JobPositionReportsToEmployee1751000000044';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE hr.job_positions
        ADD COLUMN IF NOT EXISTS reports_to_employee_id UUID
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_job_positions_reports_to_employee') THEN
          ALTER TABLE hr.job_positions ADD CONSTRAINT fk_job_positions_reports_to_employee
            FOREIGN KEY (reports_to_employee_id) REFERENCES employees.employee_records(id);
        END IF;
      END $$
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_job_positions_reports_to_employee
      ON hr.job_positions (reports_to_employee_id) WHERE reports_to_employee_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS hr.idx_job_positions_reports_to_employee`);
    await queryRunner.query(`ALTER TABLE hr.job_positions DROP CONSTRAINT IF EXISTS fk_job_positions_reports_to_employee`);
    await queryRunner.query(`ALTER TABLE hr.job_positions DROP COLUMN IF EXISTS reports_to_employee_id`);
  }
}
