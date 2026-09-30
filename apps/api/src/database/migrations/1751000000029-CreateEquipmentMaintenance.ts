import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bitácora de mantenimientos de equipo.
 *
 * La política interna pide mantenimiento cada 6 meses y hasta ahora no había
 * dónde registrarlo: `equipment_history` es auditoría de cambios de campo, no
 * una bitácora de servicios. Esta tabla guarda cada servicio realizado.
 *
 * `technician_id` es FK al catálogo de técnicos (`helpdesk.ticket_assignees`),
 * pero `technician_name` se copia al registrar: si mañana dan de baja al técnico
 * del catálogo, el histórico debe seguir diciendo quién hizo el mantenimiento.
 * Es el mismo patrón de `equipment_history.changed_by_name`.
 *
 * El FK a equipo es `ON DELETE CASCADE`: si se elimina físicamente un equipo, su
 * bitácora se va con él (el borrado de negocio es lógico, vía `deleted_at`).
 *
 * El índice es `(equipment_id, maintenance_date DESC)` porque la única consulta
 * frecuente es "mantenimientos de este equipo, del más reciente al más viejo",
 * y de ahí sale el último preventivo que reinicia el reloj de 6 meses.
 */
export class CreateEquipmentMaintenance1751000000029 implements MigrationInterface {
  name = 'CreateEquipmentMaintenance1751000000029';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS inventory.equipment_maintenance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        equipment_id UUID NOT NULL
          REFERENCES inventory.equipment(id) ON DELETE CASCADE,
        maintenance_date DATE NOT NULL,
        maintenance_type VARCHAR(20) NOT NULL DEFAULT 'Preventivo',
        technician_id UUID
          REFERENCES helpdesk.ticket_assignees(id),
        technician_name VARCHAR(200) NOT NULL,
        observations TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        deleted_by UUID
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_equipment_date
        ON inventory.equipment_maintenance(equipment_id, maintenance_date DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS inventory.idx_equipment_maintenance_equipment_date`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS inventory.equipment_maintenance`);
  }
}
