import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConsolidateDocumentTypes1719200000000 implements MigrationInterface {
  name = 'ConsolidateDocumentTypes1719200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // A) Add missing columns to document_types
    await queryRunner.query(`
      ALTER TABLE catalogs.document_types
        ADD COLUMN IF NOT EXISTS applies_to  VARCHAR(20) DEFAULT 'client',
        ADD COLUMN IF NOT EXISTS is_required BOOLEAN     DEFAULT false,
        ADD COLUMN IF NOT EXISTS description TEXT
    `);

    // B) Migrate employee_document_types → document_types (applies_to = 'employee')
    await queryRunner.query(`
      INSERT INTO catalogs.document_types (name, description, applies_to, is_required, is_active, sort_order)
      SELECT name, description, 'employee', false, is_active, sort_order
      FROM catalogs.employee_document_types
      ON CONFLICT (name) DO NOTHING
    `);

    // C) Ensure all existing rows have applies_to set (they already default to 'client')
    await queryRunner.query(`
      UPDATE catalogs.document_types
      SET applies_to = 'client'
      WHERE applies_to IS NULL
    `);

    // D) Seed vendor document types
    await queryRunner.query(`
      INSERT INTO catalogs.document_types (name, description, applies_to, is_required, is_active, sort_order)
      VALUES
        ('Constancia de situación fiscal',          'RFC y situación ante el SAT',                 'vendor', true,  true, 1),
        ('Comprobante de domicilio',                 'Máximo 3 meses de antigüedad',                'vendor', true,  true, 2),
        ('Identificación oficial del representante', 'INE, pasaporte o cédula',                    'vendor', true,  true, 3),
        ('Acta constitutiva',                        'Documento de constitución de la empresa',     'vendor', false, true, 4),
        ('Estado de cuenta bancario',                'Para alta de CLABE interbancaria',            'vendor', true,  true, 5),
        ('Opinión de cumplimiento SAT',              'Vigente, positiva',                           'vendor', false, true, 6),
        ('Contrato de servicios',                    'Firmado por ambas partes',                    'vendor', false, true, 7)
      ON CONFLICT (name) DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Remove vendor seeds
    await queryRunner.query(`
      DELETE FROM catalogs.document_types WHERE applies_to = 'vendor'
    `);

    // Remove migrated employee types
    await queryRunner.query(`
      DELETE FROM catalogs.document_types WHERE applies_to = 'employee'
    `);

    // Drop added columns
    await queryRunner.query(`
      ALTER TABLE catalogs.document_types
        DROP COLUMN IF EXISTS description,
        DROP COLUMN IF EXISTS is_required,
        DROP COLUMN IF EXISTS applies_to
    `);
  }
}
