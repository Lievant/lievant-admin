import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInventoryModule1719700000000 implements MigrationInterface {
  name = 'CreateInventoryModule1719700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS inventory`);

    await queryRunner.query(`
      CREATE TABLE inventory.equipment (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        display_id VARCHAR(20) NOT NULL UNIQUE,
        legacy_id VARCHAR(50),

        equipment_type VARCHAR(50) NOT NULL,
        brand VARCHAR(100),
        model VARCHAR(200),
        serial_number VARCHAR(100),

        operating_system VARCHAR(50),
        ad_name VARCHAR(100),
        specifications TEXT,

        assigned_to_employee_id UUID REFERENCES employees.employee_records(id),
        assignment_date DATE,
        responsiva VARCHAR(255),
        charger_included BOOLEAN DEFAULT false,

        status VARCHAR(50) NOT NULL DEFAULT 'Disponible',
        location VARCHAR(100),
        area VARCHAR(100),

        purchase_date DATE,
        purchase_value DECIMAL(12,2) DEFAULT 0,

        notes TEXT,

        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        deleted_by UUID REFERENCES auth.users(id)
      )
    `);

    await queryRunner.query(`CREATE INDEX ON inventory.equipment(equipment_type)`);
    await queryRunner.query(`CREATE INDEX ON inventory.equipment(status)`);
    await queryRunner.query(`CREATE INDEX ON inventory.equipment(assigned_to_employee_id)`);
    await queryRunner.query(`CREATE INDEX ON inventory.equipment(location)`);
    await queryRunner.query(`CREATE INDEX ON inventory.equipment(area)`);
    await queryRunner.query(`CREATE INDEX ON inventory.equipment(legacy_id)`);

    await queryRunner.query(`
      CREATE TABLE inventory.equipment_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        equipment_id UUID NOT NULL REFERENCES inventory.equipment(id),
        changed_by_id UUID REFERENCES auth.users(id),
        changed_by_name VARCHAR(200) NOT NULL,
        action VARCHAR(100) NOT NULL,
        field_changed VARCHAR(100),
        old_value TEXT,
        new_value TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX ON inventory.equipment_history(equipment_id)`);

    await queryRunner.query(`
      CREATE TABLE inventory.equipment_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        icon VARCHAR(50) DEFAULT 'ti-device-laptop',
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0
      )
    `);

    await queryRunner.query(`
      CREATE TABLE inventory.equipment_brands (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0
      )
    `);

    await queryRunner.query(`
      CREATE TABLE inventory.equipment_statuses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        color VARCHAR(20) DEFAULT 'gray',
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0
      )
    `);

    await queryRunner.query(`
      INSERT INTO inventory.equipment_types (name, icon, sort_order) VALUES
      ('Laptop', 'ti-device-laptop', 1),
      ('PC Escritorio', 'ti-device-desktop', 2),
      ('Monitor', 'ti-device-desktop-analytics', 3),
      ('Teclado', 'ti-keyboard', 4),
      ('Mouse', 'ti-mouse', 5),
      ('Celular', 'ti-device-mobile', 6),
      ('Adaptador', 'ti-plug-connected', 7),
      ('Audifonos', 'ti-headphones', 8),
      ('Micrófono', 'ti-microphone', 9),
      ('WebCam', 'ti-camera', 10),
      ('Cámara', 'ti-camera', 11),
      ('Tableta', 'ti-device-tablet', 12),
      ('Memoria Ext', 'ti-device-usb', 13),
      ('Pantalla', 'ti-device-tv', 14),
      ('Pantalla de Luz', 'ti-bulb', 15),
      ('Megáfono', 'ti-speakerphone', 16),
      ('Base', 'ti-device-laptop', 17),
      ('Cable', 'ti-plug', 18)
    `);

    await queryRunner.query(`
      INSERT INTO inventory.equipment_brands (name, sort_order) VALUES
      ('Dell',1),('HP',2),('Lenovo',3),('Apple',4),('Logitech',5),
      ('Samsung',6),('Honor',7),('Xiaomi',8),('LG',9),('ASUS',10),
      ('Ugreen',11),('Microsoft',12),('Billboard',13),('Lanix',14),
      ('BENQ',15),('JBL',16),('Acer',17),('Anker',18),('Canon',19),
      ('DJI',20),('Wacom',21),('Motorola',22),('Oppo',23),
      ('Huawei',24),('Sony',25),('Philips',26),('Genérico',27)
    `);

    await queryRunner.query(`
      INSERT INTO inventory.equipment_statuses (name, color, sort_order) VALUES
      ('Asignado', 'blue', 1),
      ('Disponible', 'green', 2),
      ('En Reparación', 'orange', 3),
      ('En garantía', 'purple', 4),
      ('Sin Verificar', 'gray', 5),
      ('En espera de devolución', 'yellow', 6),
      ('Descompuesto', 'red', 7),
      ('Baja', 'darkred', 8),
      ('Extraviado', 'red', 9),
      ('Robado', 'darkred', 10)
    `);

    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES
        ('transformacion', 'inventario', 'read', 'Ver inventario tecnológico'),
        ('transformacion', 'inventario', 'write', 'Crear y editar equipos'),
        ('transformacion', 'inventario', 'delete', 'Dar de baja equipos')
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM auth.permissions WHERE module = 'inventario'`);
    await queryRunner.query(`DROP TABLE IF EXISTS inventory.equipment_statuses`);
    await queryRunner.query(`DROP TABLE IF EXISTS inventory.equipment_brands`);
    await queryRunner.query(`DROP TABLE IF EXISTS inventory.equipment_types`);
    await queryRunner.query(`DROP TABLE IF EXISTS inventory.equipment_history`);
    await queryRunner.query(`DROP TABLE IF EXISTS inventory.equipment`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS inventory`);
  }
}
