import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Retiro del Maestro de Licenciamientos, conservando los datos.
 *
 * El schema `licenses` (tool_catalog, employee_licenses, tool_assignments)
 * modelaba la matriz de acceso sí/no por colaborador. Se renombra a
 * `licenses_deprecated_20260919` en vez de borrarse: la UI ya se retiró, pero
 * los 68 nombres de AD y las 82 responsivas que vivían ahí no tienen
 * equivalente en el modelo nuevo y la auditoría ISO 27001 pide poder
 * reconstruir quién tuvo acceso a qué.
 *
 * Backfill: los accesos con has_access = true pasan a tools.assignments.
 *
 * El emparejamiento entre catálogos va por nombre, y al momento de escribir
 * esto NINGUNO de los 10 nombres del catálogo viejo existía en tools.tools
 * —que solo tenía 'M365 Basico'—, así que un backfill directo habría migrado
 * 0 de 480 filas. Por eso el paso previo: toda herramienta del catálogo viejo
 * que no exista por nombre en el nuevo se da de alta ahí, con los mismos
 * nombres, para que el JOIN case por construcción y no por suerte.
 *
 * Esas altas llevan datos comerciales en blanco (proveedor 'Por definir',
 * costo 0, periodo mensual, categoría 'Otro'): la tabla vieja no los tenía y
 * inventarlos sería peor que dejarlos pendientes de captura.
 *
 * Ojo con 'MS Basic' (viejo) y 'M365 Basico' (nuevo): son nombres distintos,
 * así que quedan como dos herramientas separadas. Si resultan ser la misma,
 * la fusión es una decisión de negocio, no algo que esta migración deba
 * adivinar con 78 accesos de por medio.
 */
export class RemoveLicensesMaster1751000000024 implements MigrationInterface {
  name = 'RemoveLicensesMaster1751000000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Baja del schema, conservando los datos ───────────────────────────
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'licenses')
        THEN
          ALTER SCHEMA licenses RENAME TO licenses_deprecated_20260919;
        END IF;
      END $$
    `);

    // ── 2. Altas en el catálogo nuevo para lo que no existe por nombre ──────
    await queryRunner.query(`
      INSERT INTO tools.tools (
        tool_code, name, category, provider, billing_period,
        unit_cost, currency, cost_center, contract_status, requires_approval
      )
      SELECT 'HTA-' || LPAD(nextval('tools.tool_number_seq')::text, 3, '0'),
             tc.name,
             'Otro',
             'Por definir',
             'mensual',
             0, 'MXN', 'TI', 'activo', false
      FROM licenses_deprecated_20260919.tool_catalog tc
      WHERE NOT EXISTS (
        SELECT 1 FROM tools.tools t
        WHERE LOWER(t.name) = LOWER(tc.name) AND t.deleted_at IS NULL
      )
    `);

    // ── 3. Backfill de los accesos vigentes ─────────────────────────────────
    // El JOIN a employee_licenses va por employee_license_id, que es la FK real
    // de la tabla vieja.
    await queryRunner.query(`
      INSERT INTO tools.assignments (
        id, assignment_code, tool_id, employee_id,
        assigned_by_id, assigned_by_name,
        assignment_date, status, notes, created_at, updated_at
      )
      SELECT gen_random_uuid(),
             'ASG-' || LPAD(nextval('tools.assignment_number_seq')::text, 6, '0'),
             t.id,
             e.id,
             NULL,
             'Migración automática',
             COALESCE(la.granted_at::date, NOW()::date),
             'activo',
             'Migrada desde el Maestro de Licenciamientos el 2026-09-19',
             NOW(), NOW()
      FROM licenses_deprecated_20260919.tool_assignments la
      JOIN licenses_deprecated_20260919.tool_catalog tc ON tc.id = la.tool_id
      JOIN tools.tools t ON LOWER(t.name) = LOWER(tc.name) AND t.deleted_at IS NULL
      JOIN licenses_deprecated_20260919.employee_licenses el ON el.id = la.employee_license_id
      JOIN employees.employee_records e ON e.id = el.employee_id
      WHERE la.has_access = true
        AND e.deleted_at IS NULL
      ON CONFLICT DO NOTHING
    `);

    // ── 4. Contadores del catálogo ──────────────────────────────────────────
    // También el costo: AssignmentsService lo mantiene como unit_cost × activas,
    // y dejarlo sin recalcular mostraría licencias con costo cero.
    await queryRunner.query(`
      UPDATE tools.tools t
      SET active_assignments_count = agg.count,
          total_cost_calculated = (t.unit_cost * agg.count)::numeric(14,2),
          updated_at = NOW()
      FROM (
        SELECT t2.id,
               COUNT(a.id) FILTER (
                 WHERE a.status = 'activo' AND a.deleted_at IS NULL
               )::int AS count
        FROM tools.tools t2
        LEFT JOIN tools.assignments a ON a.tool_id = t2.id
        GROUP BY t2.id
      ) AS agg
      WHERE t.id = agg.id
    `);

    // ── 5. Permisos huérfanos ───────────────────────────────────────────────
    // 'transformacion.licenciamientos' (este maestro) y 'transformacion.licencias'
    // (de tools.licenses, depreciada en la migración 23) ya no tienen endpoint
    // ni pantalla. 'rrhh.empleados.licencias' SÍ se conserva: la pestaña del
    // expediente sigue, ahora sobre GET /assignments/by-employee/:id.
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (
        SELECT id FROM auth.permissions
        WHERE section = 'transformacion' AND module IN ('licenciamientos', 'licencias')
      )
    `);
    await queryRunner.query(`
      DELETE FROM auth.user_permissions
      WHERE permission_id IN (
        SELECT id FROM auth.permissions
        WHERE section = 'transformacion' AND module IN ('licenciamientos', 'licencias')
      )
    `);
    await queryRunner.query(`
      DELETE FROM auth.permissions
      WHERE section = 'transformacion' AND module IN ('licenciamientos', 'licencias')
    `);
  }

  /**
   * Devuelve el schema a su nombre y retira lo que sembró el backfill. Las
   * herramientas creadas en el paso 2 se borran solo si nadie las usó para algo
   * más: si ya tienen asignaciones capturadas a mano, se quedan.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM tools.assignments
      WHERE assigned_by_name = 'Migración automática'
    `);

    await queryRunner.query(`
      DELETE FROM tools.tools t
      WHERE t.provider = 'Por definir'
        AND NOT EXISTS (SELECT 1 FROM tools.assignments a WHERE a.tool_id = t.id)
    `);

    await queryRunner.query(`
      UPDATE tools.tools SET active_assignments_count = 0, total_cost_calculated = 0
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.schemata
          WHERE schema_name = 'licenses_deprecated_20260919'
        ) THEN
          ALTER SCHEMA licenses_deprecated_20260919 RENAME TO licenses;
        END IF;
      END $$
    `);
  }
}
