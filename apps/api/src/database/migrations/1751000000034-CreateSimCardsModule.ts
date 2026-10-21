import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Líneas Telefónicas (inventario de SIMs) de Transformación Digital.
 *
 * Todo es aditivo: solo crea objetos nuevos en `inventory` y agrega filas de
 * permisos; no altera ninguna tabla existente (ni `inventory.equipment`).
 *
 * - `sim_plans`: catálogo de planes. El proveedor vive aquí (`vendor_id`), no en
 *   la SIM: la SIM lo hereda del plan.
 * - `sim_cards`: una fila por línea. `employee_id` y `equipment_id` son
 *   independientes (persona, equipo, ambos o ninguno); "sin asignar" se deriva de
 *   `employee_id IS NULL`, no hay un estado aparte. El costo de la SIM es
 *   opcional y, si falta, se usa el del plan.
 * - `sim_card_history`: un renglón por cada asignación y desasignación, con quién
 *   la hizo. `action` distingue el evento; en una desasignación `employee_id` /
 *   `equipment_id` son lo que se liberó y `returned_date` la fecha en que se
 *   liberó.
 *
 * Los códigos `SIM-001`… salen de su propia secuencia (nunca de un COUNT: un
 * COUNT repite códigos al dar de baja o ante inserciones concurrentes).
 *
 * Los únicos de número e ICCID son parciales (`deleted_at IS NULL`): una línea
 * dada de baja libera su número para reutilizarlo.
 *
 * Permisos: `transformacion.sim-cards.read|write`, para SUPER_ADMIN y DIRECTOR
 * (mismo patrón que las migraciones 025 y 027).
 */
export class CreateSimCardsModule1751000000034 implements MigrationInterface {
  name = 'CreateSimCardsModule1751000000034';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS inventory.sim_card_code_seq START 1`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS inventory.sim_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) NOT NULL,
        vendor_id UUID NOT NULL REFERENCES vendors.vendors(id),
        monthly_cost NUMERIC(12,2) NOT NULL CONSTRAINT chk_sim_plans_cost CHECK (monthly_cost >= 0),
        currency VARCHAR(3) NOT NULL DEFAULT 'MXN' CONSTRAINT chk_sim_plans_currency CHECK (currency IN ('MXN', 'USD')),
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_by UUID,
        updated_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        deleted_by UUID
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_sim_plans_vendor_name_alive
        ON inventory.sim_plans (vendor_id, lower(name)) WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS inventory.sim_cards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sim_code VARCHAR(20) NOT NULL UNIQUE,
        phone_number VARCHAR(20) NOT NULL,
        iccid VARCHAR(25),
        plan_id UUID NOT NULL REFERENCES inventory.sim_plans(id),
        employee_id UUID REFERENCES employees.employee_records(id),
        equipment_id UUID REFERENCES inventory.equipment(id),
        monthly_cost NUMERIC(12,2) CONSTRAINT chk_sim_cards_cost CHECK (monthly_cost IS NULL OR monthly_cost >= 0),
        currency VARCHAR(3) NOT NULL DEFAULT 'MXN' CONSTRAINT chk_sim_cards_currency CHECK (currency IN ('MXN', 'USD')),
        term_months INTEGER CONSTRAINT chk_sim_cards_term CHECK (term_months IS NULL OR term_months > 0),
        contract_end_date DATE,
        activation_date DATE,
        assigned_date DATE,
        status VARCHAR(20) NOT NULL DEFAULT 'activa' CONSTRAINT chk_sim_cards_status CHECK (status IN ('activa', 'suspendida', 'cancelada')),
        device_type VARCHAR(20) NOT NULL DEFAULT 'smartphone' CONSTRAINT chk_sim_cards_device CHECK (device_type IN ('smartphone', 'tablet', 'modem', 'otro')),
        notes TEXT,
        created_by UUID,
        updated_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        deleted_by UUID
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_sim_cards_phone_alive
        ON inventory.sim_cards (phone_number) WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_sim_cards_iccid_alive
        ON inventory.sim_cards (iccid) WHERE deleted_at IS NULL AND iccid IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sim_cards_employee ON inventory.sim_cards (employee_id) WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sim_cards_equipment ON inventory.sim_cards (equipment_id) WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sim_cards_plan ON inventory.sim_cards (plan_id) WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sim_cards_contract_end ON inventory.sim_cards (contract_end_date) WHERE deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS inventory.sim_card_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sim_card_id UUID NOT NULL REFERENCES inventory.sim_cards(id),
        action VARCHAR(20) NOT NULL CONSTRAINT chk_sim_history_action CHECK (action IN ('asignacion', 'desasignacion')),
        employee_id UUID REFERENCES employees.employee_records(id),
        equipment_id UUID REFERENCES inventory.equipment(id),
        assigned_date DATE,
        returned_date DATE,
        notes TEXT,
        changed_by UUID,
        changed_by_name VARCHAR(200),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sim_card_history_sim ON inventory.sim_card_history (sim_card_id, created_at DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sim_card_history_employee ON inventory.sim_card_history (employee_id, created_at DESC)
    `);

    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES
        ('transformacion', 'sim-cards', 'read', 'Ver líneas telefónicas (SIMs)'),
        ('transformacion', 'sim-cards', 'write', 'Gestionar líneas telefónicas, planes y asignaciones; ver ICCID')
      ON CONFLICT (section, module, action) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth.roles r, auth.permissions p
      WHERE r.name IN ('SUPER_ADMIN', 'DIRECTOR')
        AND p.section = 'transformacion' AND p.module = 'sim-cards'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM auth.user_permissions
      WHERE permission_id IN (SELECT id FROM auth.permissions WHERE section = 'transformacion' AND module = 'sim-cards')
    `);
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (SELECT id FROM auth.permissions WHERE section = 'transformacion' AND module = 'sim-cards')
    `);
    await queryRunner.query(`DELETE FROM auth.permissions WHERE section = 'transformacion' AND module = 'sim-cards'`);

    await queryRunner.query(`DROP INDEX IF EXISTS inventory.idx_sim_card_history_employee`);
    await queryRunner.query(`DROP INDEX IF EXISTS inventory.idx_sim_card_history_sim`);
    await queryRunner.query(`DROP TABLE IF EXISTS inventory.sim_card_history`);

    await queryRunner.query(`DROP INDEX IF EXISTS inventory.idx_sim_cards_contract_end`);
    await queryRunner.query(`DROP INDEX IF EXISTS inventory.idx_sim_cards_plan`);
    await queryRunner.query(`DROP INDEX IF EXISTS inventory.idx_sim_cards_equipment`);
    await queryRunner.query(`DROP INDEX IF EXISTS inventory.idx_sim_cards_employee`);
    await queryRunner.query(`DROP INDEX IF EXISTS inventory.uq_sim_cards_iccid_alive`);
    await queryRunner.query(`DROP INDEX IF EXISTS inventory.uq_sim_cards_phone_alive`);
    await queryRunner.query(`DROP TABLE IF EXISTS inventory.sim_cards`);

    await queryRunner.query(`DROP INDEX IF EXISTS inventory.uq_sim_plans_vendor_name_alive`);
    await queryRunner.query(`DROP TABLE IF EXISTS inventory.sim_plans`);

    await queryRunner.query(`DROP SEQUENCE IF EXISTS inventory.sim_card_code_seq`);
  }
}
