import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Datos de garantía del equipo.
 *
 * El proveedor va como FK a `vendors.vendors` y no como texto: la garantía se
 * reclama contra un proveedor concreto, y ese padrón ya existe con su RFC y
 * sus contactos. Sin FK volveríamos a lo que pasó con `equipment.brand`, donde
 * el texto libre dejó 23 variantes fuera del catálogo.
 *
 * La factura se guarda como llave de S3 más el nombre original: la llave lleva
 * timestamp para no colisionar y el nombre original es el que el usuario
 * reconoce al descargarla.
 *
 * El índice de vencimientos es parcial. Solo una fracción de los equipos tiene
 * garantía registrada, y la única consulta que lo usa —el reporte de garantías
 * por vencer— filtra siempre por fecha no nula y equipo vivo; indexar las filas
 * sin garantía sería peso muerto en cada alta de inventario.
 */
export class AddEquipmentWarranty1751000000026 implements MigrationInterface {
  name = 'AddEquipmentWarranty1751000000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE inventory.equipment
        ADD COLUMN IF NOT EXISTS warranty_provider_id UUID
          REFERENCES vendors.vendors(id),
        ADD COLUMN IF NOT EXISTS warranty_invoice_s3_key VARCHAR(500),
        ADD COLUMN IF NOT EXISTS warranty_invoice_original_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS warranty_expiry_date DATE,
        ADD COLUMN IF NOT EXISTS warranty_purchase_order VARCHAR(100),
        ADD COLUMN IF NOT EXISTS warranty_notes TEXT
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_equipment_warranty_expiry
        ON inventory.equipment(warranty_expiry_date)
        WHERE warranty_expiry_date IS NOT NULL AND deleted_at IS NULL
    `);

    // Busca por proveedor: "qué equipos cubre esta garantía" al renegociar.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_equipment_warranty_provider
        ON inventory.equipment(warranty_provider_id)
        WHERE warranty_provider_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS inventory.idx_equipment_warranty_provider`);
    await queryRunner.query(`DROP INDEX IF EXISTS inventory.idx_equipment_warranty_expiry`);

    await queryRunner.query(`
      ALTER TABLE inventory.equipment
        DROP COLUMN IF EXISTS warranty_notes,
        DROP COLUMN IF EXISTS warranty_purchase_order,
        DROP COLUMN IF EXISTS warranty_expiry_date,
        DROP COLUMN IF EXISTS warranty_invoice_original_name,
        DROP COLUMN IF EXISTS warranty_invoice_s3_key,
        DROP COLUMN IF EXISTS warranty_provider_id
    `);
  }
}
