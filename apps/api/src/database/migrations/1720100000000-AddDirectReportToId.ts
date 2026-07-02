import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDirectReportToId1720100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE employees.employee_records
        ADD COLUMN IF NOT EXISTS direct_report_to_id UUID
          REFERENCES employees.employee_records(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      UPDATE employees.employee_records e1
      SET direct_report_to_id = e2.id
      FROM employees.employee_records e2
      WHERE UPPER(TRIM(e1.direct_report_to)) = UPPER(TRIM(e2.full_name))
        AND e1.direct_report_to IS NOT NULL
        AND e1.direct_report_to != ''
        AND e1.deleted_at IS NULL
        AND e2.deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE employees.employee_records
        DROP COLUMN IF EXISTS direct_report_to_id
    `);
  }
}
