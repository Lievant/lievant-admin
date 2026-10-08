import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Información financiera del equipo: proveedor y factura de compra.
 *
 * El proveedor es FK a `vendors.vendors`, igual que el de garantía (026): son
 * columnas distintas porque quien vende el equipo no siempre es quien atiende
 * la garantía (p. ej. compra en distribuidor, garantía directa con la marca).
 *
 * `purchase_value` ya existía desde 1719700000000 como DECIMAL(12,2) NOT NULL
 * DEFAULT 0, así que no se crea otra columna: se amplía a (14,2) y se vuelve
 * nullable. El 0 era el default, no un precio capturado, y con él la
 * depreciación mostraría "valor actual $0.00" en equipos que nunca tuvieron
 * valor registrado; por eso los 0 pasan a NULL ("sin dato"). El cambio es
 * compatible con el código anterior: todos sus lectores ya toleran null.
 *
 * La depreciación (valor/36 por mes) no se guarda: se calcula al leer, porque
 * cambia cada mes sin que nadie toque el registro.
 *
 * El índice de fecha de factura es parcial por la misma razón que el de
 * garantías: pocos equipos la tendrán y las consultas filtran por no nula y
 * equipo vivo.
 */
export class AddEquipmentFinancialInfo1751000000032 implements MigrationInterface {
  name = 'AddEquipmentFinancialInfo1751000000032';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE inventory.equipment
        ADD COLUMN IF NOT EXISTS financial_provider_id UUID
          REFERENCES vendors.vendors(id),
        ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100),
        ADD COLUMN IF NOT EXISTS invoice_date DATE
    `);

    await queryRunner.query(`
      ALTER TABLE inventory.equipment
        ALTER COLUMN purchase_value TYPE DECIMAL(14,2),
        ALTER COLUMN purchase_value DROP DEFAULT,
        ALTER COLUMN purchase_value DROP NOT NULL
    `);

    await queryRunner.query(
      `UPDATE inventory.equipment SET purchase_value = NULL WHERE purchase_value = 0`,
    );

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_equipment_invoice_date
        ON inventory.equipment(invoice_date)
        WHERE invoice_date IS NOT NULL AND deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS inventory.idx_equipment_invoice_date`);

    await queryRunner.query(
      `UPDATE inventory.equipment SET purchase_value = 0 WHERE purchase_value IS NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE inventory.equipment
        ALTER COLUMN purchase_value SET NOT NULL,
        ALTER COLUMN purchase_value SET DEFAULT 0,
        ALTER COLUMN purchase_value TYPE DECIMAL(12,2)
    `);

    await queryRunner.query(`
      ALTER TABLE inventory.equipment
        DROP COLUMN IF EXISTS invoice_date,
        DROP COLUMN IF EXISTS invoice_number,
        DROP COLUMN IF EXISTS financial_provider_id
    `);
  }
}
