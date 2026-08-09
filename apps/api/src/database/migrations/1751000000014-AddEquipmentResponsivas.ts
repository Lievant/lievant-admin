import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Responsivas TIC-RE-02 como entidad propia.
 *
 * Hasta ahora el folio vivía en `inventory.equipment.responsiva`, una columna de
 * texto repetida en cada equipo del colaborador. Eso hacía imposible responder
 * "¿este colaborador ya firmó?" sin recorrer sus equipos, y permitía que dos
 * equipos de la misma persona quedaran con folios distintos (pasa hoy en
 * TIC-RE-02-0017, 0026 y 0102). La responsiva es del colaborador, no del equipo,
 * así que vive en su propia tabla con UNIQUE por empleado.
 *
 * La columna vieja se conserva: es la fuente con la que se cargan los 114 folios
 * históricos y sirve de respaldo si hubiera que reconciliar.
 */
export class AddEquipmentResponsivas1751000000014 implements MigrationInterface {
  name = 'AddEquipmentResponsivas1751000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS inventory.equipment_responsivas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES employees.employee_records(id),
        code VARCHAR(20) NOT NULL UNIQUE,
        generated_at TIMESTAMPTZ DEFAULT NOW(),
        generated_by UUID REFERENCES auth.users(id),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_equipment_responsivas_employee
        ON inventory.equipment_responsivas(employee_id)
    `);

    // Un colaborador tiene una sola responsiva vigente. Sin esto, dos clics
    // seguidos en "Generar responsiva" quemarían dos folios de la secuencia
    // para la misma persona.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_equipment_responsivas_employee
        ON inventory.equipment_responsivas(employee_id)
    `);

    // El UNIQUE de la columna `code` ya crea su propio índice; no se agrega otro.

    // Arranca en 115 porque los folios 0001..0114 son los documentos firmados
    // que ya existen en la carpeta de responsivas.
    await queryRunner.query(`
      CREATE SEQUENCE IF NOT EXISTS inventory.responsiva_seq
        START 115
        INCREMENT 1
        MINVALUE 1
        MAXVALUE 9999
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SEQUENCE IF EXISTS inventory.responsiva_seq`);
    await queryRunner.query(`DROP TABLE IF EXISTS inventory.equipment_responsivas`);
  }
}
