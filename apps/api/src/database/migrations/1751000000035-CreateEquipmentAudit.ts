import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Auditoría de Equipos (TIC-RE-18).
 *
 * Todo es aditivo: una columna nullable en `inventory.equipment`, un schema
 * nuevo `audits` y filas de catálogo y permisos.
 *
 * - `inventory.equipment.mac_address`: la MAC que la auditoría registra y, al
 *   completarla, sincroniza al inventario (formato XX:XX:XX:XX:XX:XX).
 * - `audits.equipment_audits`: encabezado, mantenimiento preventivo y encuesta.
 *   Nombre, área y cargo del colaborador y el nombre del técnico se guardan como
 *   snapshot: el formato impreso debe decir lo que era cierto ese día.
 * - `audits.audit_equipment_items` / `audit_license_items`: un renglón por equipo
 *   y por licencia asignados al colaborador al abrir la auditoría.
 *
 * Los códigos `AUD-000001`… salen de su propia secuencia (nunca de un COUNT).
 *
 * El ticket de mantenimiento que se genera al completar usa la subcategoría
 * "Mantenimiento preventivo" de `equipos`, que se agrega aquí al catálogo.
 *
 * Permisos: `transformacion.auditoria-equipos.read|write`, para SUPER_ADMIN y
 * DIRECTOR (mismo patrón que la 034).
 */
export class CreateEquipmentAudit1751000000035 implements MigrationInterface {
  name = 'CreateEquipmentAudit1751000000035';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE inventory.equipment ADD COLUMN IF NOT EXISTS mac_address VARCHAR(17)`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_equipment_mac
        ON inventory.equipment (mac_address) WHERE mac_address IS NOT NULL AND deleted_at IS NULL
    `);

    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS audits`);
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS audits.audit_number_seq START 1 INCREMENT 1`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audits.equipment_audits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        audit_code VARCHAR(15) NOT NULL UNIQUE,
        audit_date DATE NOT NULL DEFAULT CURRENT_DATE,
        technician_id UUID NOT NULL REFERENCES auth.users(id),
        technician_name VARCHAR(200) NOT NULL,
        employee_id UUID NOT NULL REFERENCES employees.employee_records(id),
        employee_name VARCHAR(200) NOT NULL,
        employee_area VARCHAR(100),
        employee_position VARCHAR(200),
        status VARCHAR(20) NOT NULL DEFAULT 'en_progreso'
          CONSTRAINT chk_equipment_audits_status CHECK (status IN ('en_progreso', 'completada', 'con_observaciones')),
        completed_at TIMESTAMPTZ,
        maintenance_ticket_id UUID REFERENCES helpdesk.tickets(id),
        general_notes TEXT,
        survey_equipment_score INTEGER CONSTRAINT chk_equipment_audits_survey_equipment CHECK (survey_equipment_score BETWEEN 1 AND 5),
        survey_equipment_notes TEXT,
        survey_it_service_score INTEGER CONSTRAINT chk_equipment_audits_survey_it CHECK (survey_it_service_score BETWEEN 1 AND 5),
        survey_it_service_notes TEXT,
        survey_platform_score INTEGER CONSTRAINT chk_equipment_audits_survey_platform CHECK (survey_platform_score BETWEEN 1 AND 5),
        survey_platform_notes TEXT,
        maintenance_blower BOOLEAN,
        maintenance_keyboard_cleaning BOOLEAN,
        maintenance_screen_cleaning BOOLEAN,
        maintenance_logical_unit BOOLEAN,
        maintenance_drivers_updated BOOLEAN,
        maintenance_antivirus_removed BOOLEAN,
        maintenance_cache_cleaned BOOLEAN,
        maintenance_bitlocker_active BOOLEAN,
        maintenance_browser_passwords_cleared BOOLEAN,
        maintenance_onedrive_synced BOOLEAN,
        maintenance_onedrive_backup BOOLEAN,
        maintenance_no_c_root_folders BOOLEAN,
        maintenance_shared_accounts TEXT,
        maintenance_notes TEXT,
        created_by UUID REFERENCES auth.users(id),
        updated_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_equipment_audits_employee
        ON audits.equipment_audits (employee_id) WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_equipment_audits_date
        ON audits.equipment_audits (audit_date DESC, created_at DESC) WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audits.audit_equipment_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        audit_id UUID NOT NULL REFERENCES audits.equipment_audits(id) ON DELETE CASCADE,
        equipment_id UUID NOT NULL REFERENCES inventory.equipment(id),
        equipment_code VARCHAR(20),
        equipment_brand VARCHAR(100),
        equipment_model VARCHAR(200),
        equipment_type VARCHAR(50),
        physically_present BOOLEAN,
        label_marked BOOLEAN,
        mac_address VARCHAR(17),
        mac_synced_to_inventory BOOLEAN NOT NULL DEFAULT false,
        unassigned_during_audit BOOLEAN NOT NULL DEFAULT false,
        not_present_reason TEXT,
        sim_verified BOOLEAN,
        sim_card_id UUID REFERENCES inventory.sim_cards(id),
        sim_notes TEXT,
        equipment_notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_equipment_items_audit ON audits.audit_equipment_items (audit_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_equipment_items_equipment ON audits.audit_equipment_items (equipment_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audits.audit_license_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        audit_id UUID NOT NULL REFERENCES audits.equipment_audits(id) ON DELETE CASCADE,
        assignment_id UUID NOT NULL REFERENCES tools.assignments(id),
        tool_name VARCHAR(200),
        tool_code VARCHAR(10),
        license_present BOOLEAN,
        missing_notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_license_items_audit ON audits.audit_license_items (audit_id)
    `);

    await queryRunner.query(`
      INSERT INTO helpdesk.subcategories (category_slug, name, sort_order)
      VALUES ('equipos', 'Mantenimiento preventivo', 10)
      ON CONFLICT (category_slug, name) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES
        ('transformacion', 'auditoria-equipos', 'read', 'Ver auditorías de equipos TIC-RE-18'),
        ('transformacion', 'auditoria-equipos', 'write', 'Realizar auditorías de equipos TIC-RE-18')
      ON CONFLICT (section, module, action) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth.roles r, auth.permissions p
      WHERE r.name IN ('SUPER_ADMIN', 'DIRECTOR')
        AND p.section = 'transformacion' AND p.module = 'auditoria-equipos'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM auth.user_permissions
      WHERE permission_id IN (SELECT id FROM auth.permissions WHERE section = 'transformacion' AND module = 'auditoria-equipos')
    `);
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (SELECT id FROM auth.permissions WHERE section = 'transformacion' AND module = 'auditoria-equipos')
    `);
    await queryRunner.query(`DELETE FROM auth.permissions WHERE section = 'transformacion' AND module = 'auditoria-equipos'`);

    // La subcategoría se conserva si algún ticket ya la usa.
    await queryRunner.query(`
      DELETE FROM helpdesk.subcategories s
      WHERE s.category_slug = 'equipos' AND s.name = 'Mantenimiento preventivo'
        AND NOT EXISTS (
          SELECT 1 FROM helpdesk.tickets t WHERE t.category = 'equipos' AND t.subcategory = 'Mantenimiento preventivo'
        )
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS audits.audit_license_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS audits.audit_equipment_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS audits.equipment_audits`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS audits.audit_number_seq`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS audits`);

    await queryRunner.query(`DROP INDEX IF EXISTS inventory.idx_equipment_mac`);
    await queryRunner.query(`ALTER TABLE inventory.equipment DROP COLUMN IF EXISTS mac_address`);
  }
}
