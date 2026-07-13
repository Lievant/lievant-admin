import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * El sistema de catálogos usa tablas por entidad (no catalog_types/catalog_items).
 * Las marcas de equipos ya viven en inventory.equipment_brands (creada por el
 * módulo de inventario). Esta migración solo agrega las marcas comunes que aún
 * no existen, comparando por nombre sin distinguir mayúsculas para no duplicar
 * variantes ya presentes (p.ej. "ASUS").
 */
export class AddEquipmentBrandsCatalog1721000000000 implements MigrationInterface {
  private readonly seededNames = ['Epson', 'Brother', 'Cisco', 'Ubiquiti'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO inventory.equipment_brands (name, is_active, sort_order)
      SELECT v.name, true,
             (SELECT COALESCE(MAX(sort_order), 0) FROM inventory.equipment_brands) + v.idx
      FROM (VALUES
        ('Apple', 1), ('Dell', 2), ('HP', 3), ('Lenovo', 4),
        ('Samsung', 5), ('LG', 6), ('Asus', 7), ('Acer', 8),
        ('Microsoft', 9), ('Sony', 10), ('Logitech', 11),
        ('Epson', 12), ('Canon', 13), ('Brother', 14),
        ('Cisco', 15), ('Ubiquiti', 16)
      ) AS v(name, idx)
      WHERE NOT EXISTS (
        SELECT 1 FROM inventory.equipment_brands b WHERE LOWER(b.name) = LOWER(v.name)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Solo elimina las marcas que esta migración pudo haber agregado.
    await queryRunner.query(
      `DELETE FROM inventory.equipment_brands WHERE name = ANY($1::text[])`,
      [this.seededNames],
    );
  }
}
