import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Capacitaciones: listas cerradas ampliadas.
 *
 *  - `development_type`: + 'sgsi' (Sistema de Gestión de Seguridad de la Información) y 'bienestar_psicosocial'.
 *  - `level`: + 'obligatoria'.
 *  - `duration_unit`: + 'dias'.
 *
 * Los CHECK de la migración 036 son en línea y sin nombre: se localizan en `pg_constraint` por la columna que
 * mencionan y se recrean con nombre explícito (`chk_training_development_type`, `chk_training_level`,
 * `chk_training_duration_unit`). `chk_training_dates` y `chk_training_duration_pair` no se tocan. Los valores
 * anteriores siguen siendo válidos. Idempotente; sin backfill ni cambios de datos.
 *
 * `down()` vuelve a los CHECK originales, pero ANTES verifica que no existan filas con los valores nuevos: si las
 * hay, aborta con un mensaje claro y no borra ni cambia nada.
 */
export class ExtendTrainingLists1751000000049 implements MigrationInterface {
  name = 'ExtendTrainingLists1751000000049';

  /** Quita los CHECK (con o sin nombre) que mencionan la columna, excepto los dos que no se tocan. */
  private async dropChecksOf(queryRunner: QueryRunner, column: string): Promise<void> {
    await queryRunner.query(
      `DO $$
       DECLARE c RECORD;
       BEGIN
         FOR c IN
           SELECT conname FROM pg_constraint
           WHERE conrelid = 'employees.employee_trainings'::regclass
             AND contype = 'c'
             AND conname NOT IN ('chk_training_dates', 'chk_training_duration_pair')
             AND pg_get_constraintdef(oid) ~ '\\m${column}\\M'
         LOOP
           EXECUTE format('ALTER TABLE employees.employee_trainings DROP CONSTRAINT %I', c.conname);
         END LOOP;
       END $$`,
    );
  }

  private async replace(queryRunner: QueryRunner, column: string, name: string, values: string[]): Promise<void> {
    await this.dropChecksOf(queryRunner, column);
    const list = values.map((v) => `'${v}'`).join(',');
    await queryRunner.query(
      `ALTER TABLE employees.employee_trainings ADD CONSTRAINT ${name} CHECK (${column} IN (${list}))`,
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.replace(queryRunner, 'development_type', 'chk_training_development_type', [
      'tecnico', 'habilidades_blandas', 'academico', 'sgsi', 'bienestar_psicosocial',
    ]);
    await this.replace(queryRunner, 'level', 'chk_training_level', [
      'basico', 'intermedio', 'avanzado', 'especializacion', 'obligatoria',
    ]);
    await this.replace(queryRunner, 'duration_unit', 'chk_training_duration_unit', ['horas', 'dias', 'meses']);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const used = (await queryRunner.query(
      `SELECT
         COUNT(*) FILTER (WHERE development_type IN ('sgsi','bienestar_psicosocial'))::int AS tipos,
         COUNT(*) FILTER (WHERE level = 'obligatoria')::int AS niveles,
         COUNT(*) FILTER (WHERE duration_unit = 'dias')::int AS unidades
       FROM employees.employee_trainings`,
    )) as { tipos: number; niveles: number; unidades: number }[];
    const { tipos, niveles, unidades } = used[0] ?? { tipos: 0, niveles: 0, unidades: 0 };
    if (tipos + niveles + unidades > 0) {
      throw new Error(
        `No se puede revertir la migración 049: hay capacitaciones con valores nuevos ` +
          `(tipo SGSI o Bienestar: ${tipos}; nivel Obligatoria: ${niveles}; duración en Días: ${unidades}). ` +
          `Cámbialas o elimínalas a mano antes de revertir; esta migración no toca los datos.`,
      );
    }
    await this.replace(queryRunner, 'development_type', 'employee_trainings_development_type_check', [
      'tecnico', 'habilidades_blandas', 'academico',
    ]);
    await this.replace(queryRunner, 'level', 'employee_trainings_level_check', [
      'basico', 'intermedio', 'avanzado', 'especializacion',
    ]);
    await this.replace(queryRunner, 'duration_unit', 'employee_trainings_duration_unit_check', ['horas', 'meses']);
  }
}
