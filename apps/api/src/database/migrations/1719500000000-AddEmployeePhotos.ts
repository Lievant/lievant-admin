import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmployeePhotos1719500000000 implements MigrationInterface {
  name = 'AddEmployeePhotos1719500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE employees.employee_photos (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id   UUID NOT NULL REFERENCES employees.employee_records(id),
        s3_key        VARCHAR(500) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_size     INTEGER NOT NULL,
        width         INTEGER,
        height        INTEGER,
        is_profile    BOOLEAN NOT NULL DEFAULT false,
        uploaded_by   UUID REFERENCES auth.users(id),
        uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at    TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_employee_photos_employee_id
        ON employees.employee_photos(employee_id)
        WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_employee_photos_profile
        ON employees.employee_photos(employee_id)
        WHERE is_profile = true AND deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS employees.employee_photos`);
  }
}
