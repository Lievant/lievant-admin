import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmployeeDocuments1718900000000 implements MigrationInterface {
  name = 'AddEmployeeDocuments1718900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE employees.employee_documents (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES employees.employee_records(id),
        type        VARCHAR(50) NOT NULL,
        name        VARCHAR(255) NOT NULL,
        s3_key      VARCHAR(500) NOT NULL,
        file_size   INTEGER,
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        uploaded_by UUID NOT NULL,
        deleted_at  TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_employee_documents_employee_id
        ON employees.employee_documents(employee_id)
        WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE catalogs.employee_document_types (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        is_active   BOOLEAN NOT NULL DEFAULT true,
        sort_order  SMALLINT NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      INSERT INTO catalogs.employee_document_types (name, sort_order) VALUES
        ('Identificación oficial',             0),
        ('CURP',                               1),
        ('RFC',                                2),
        ('Comprobante de domicilio',            3),
        ('Acta de nacimiento',                  4),
        ('Carta de no antecedentes penales',    5),
        ('Certificado / Título académico',      6),
        ('Contrato de trabajo',                 7),
        ('Convenio de confidencialidad',        8),
        ('Convenio de no competencia',          9),
        ('Alta IMSS',                          10),
        ('Carta de recomendación',             11),
        ('Otro',                               12)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS employees.employee_documents`);
    await queryRunner.query(`DROP TABLE IF EXISTS catalogs.employee_document_types`);
  }
}
