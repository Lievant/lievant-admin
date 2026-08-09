import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Automatización del proceso de baja de empleados.
 *
 * La categoría de HelpDesk se inserta con `slug` y sin `description`: la tabla
 * helpdesk.categories no tiene esa columna y sí exige un slug único, que además
 * es el valor que los tickets guardan en su campo `category` —la relación es por
 * slug, no por FK—.
 *
 * El tipo de notificación 'atencion' no necesita DDL: notifications.type es un
 * VARCHAR(20) sin CHECK, así que basta con ampliar la unión en TypeScript.
 */
export class AddTerminationAutomation1751000000012 implements MigrationInterface {
  name = 'AddTerminationAutomation1751000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Etiqueta del rol con el que participa un destinatario en el flujo ('TI',
    // 'CORE', 'Operaciones'). Antes el área se deducía del expediente del que
    // respondía, lo que fallaba en cuanto el nombre del área no coincidía con
    // el rol —el responsable de CORE está en Transformación Digital—.
    await queryRunner.query(`
      ALTER TABLE notifications.flow_recipients
        ADD COLUMN IF NOT EXISTS label VARCHAR(100)
    `);

    // P2 y SLA de 2/8 horas, igual que 'equipos': una baja implica revocar
    // accesos y recuperar equipo, y dejarla en P3 le daría 24 horas.
    await queryRunner.query(`
      INSERT INTO helpdesk.categories
        (id, name, slug, priority_base, sla_response_hours, sla_resolution_hours, is_active, sort_order)
      VALUES (
        gen_random_uuid(),
        'Altas y Bajas de RRHH',
        'altas_bajas',
        'P2', 2, 8, true,
        (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM helpdesk.categories)
      )
      ON CONFLICT (slug) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO notifications.notification_flows (module, event, name, description) VALUES
        ('rrhh', 'baja_registrada', 'RRHH — Baja de empleado registrada',
         'Se dispara cuando se registra la baja de un empleado'),
        ('rrhh', 'baja_atendida_ti', 'RRHH — Baja atendida por TI',
         'TI confirma que completó el proceso de baja'),
        ('rrhh', 'baja_atendida_core', 'RRHH — Baja atendida por CORE',
         'CORE confirma que completó el proceso de baja'),
        ('rrhh', 'baja_atendida_operaciones', 'RRHH — Baja atendida por Operaciones',
         'Operaciones confirma que completó el proceso de baja')
      ON CONFLICT (module, event) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM notifications.notification_flows
      WHERE module = 'rrhh' AND event LIKE 'baja_%'
    `);
    await queryRunner.query(`DELETE FROM helpdesk.categories WHERE slug = 'altas_bajas'`);
    await queryRunner.query(
      `ALTER TABLE notifications.flow_recipients DROP COLUMN IF EXISTS label`,
    );
  }
}
