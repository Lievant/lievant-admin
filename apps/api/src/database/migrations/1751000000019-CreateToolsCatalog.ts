import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Catálogo de Herramientas y Licencias.
 *
 * Va en su propio schema `tools` y no dentro de `licenses.tool_catalog`: ese
 * catálogo existente es un diccionario visual (nombre, icono, color, orden)
 * cuyo único trabajo es pintar las columnas de la matriz de licenciamientos por
 * colaborador. Este es un catálogo administrativo —costo unitario, periodo de
 * facturación, centro de costos, estado del contrato, renovación— y mezclarlo
 * con el otro obligaría a nulificar la mitad de las columnas en cada fila
 * existente y a decidir, por herramienta, cuál de las dos semánticas aplica.
 *
 * `tool_code` (HTA-001…) se arma desde una secuencia propia en lugar de
 * contarse sobre la tabla: al borrar una herramienta el conteo reutilizaría un
 * código ya impreso en reportes y cargos. La secuencia se consume desde el
 * servicio, igual que el resto de los folios del sistema.
 *
 * `total_cost_calculated` y `active_assignments_count` son denormalizaciones que
 * mantiene la capa de asignación —no columnas generadas— porque dependen de
 * filas de otra tabla; se inicializan en 0 y quedan consistentes desde la
 * primera asignación.
 */
export class CreateToolsCatalog1751000000019 implements MigrationInterface {
  name = 'CreateToolsCatalog1751000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS tools`);

    await queryRunner.query(`
      CREATE SEQUENCE IF NOT EXISTS tools.tool_number_seq
        START 1 INCREMENT 1
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tools.tools (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- Identificador legible: HTA-001, HTA-002…
        tool_code VARCHAR(10) UNIQUE NOT NULL,

        -- Información básica
        name VARCHAR(200) NOT NULL,
        category VARCHAR(100) NOT NULL,
        -- 'Correo' | 'Suite Ofimática' | 'CRM' | 'Firma Digital'
        -- 'Inteligencia Artificial' | 'Gestión de Proyectos'
        -- 'Comunicación' | 'Diseño' | 'Seguridad' | 'Otro'

        provider VARCHAR(200) NOT NULL,
        description TEXT,
        url VARCHAR(500),

        -- Costos y facturación
        unit_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
        currency VARCHAR(3) NOT NULL DEFAULT 'MXN', -- MXN | USD
        billing_period VARCHAR(20) NOT NULL,
        -- 'mensual' | 'trimestral' | 'anual' | 'unico'
        billing_day INTEGER CHECK (billing_day >= 1 AND billing_day <= 31),

        -- Administración
        cost_center VARCHAR(20) NOT NULL DEFAULT 'TI',
        -- 'TD' | 'TI' | 'Compartido'
        commercial_contact VARCHAR(200),
        next_renewal_date DATE,

        -- Estado del contrato
        contract_status VARCHAR(30) NOT NULL DEFAULT 'activo',
        -- 'activo' | 'en_negociacion' | 'por_cancelar' | 'cancelado'

        -- Control de asignación
        requires_approval BOOLEAN NOT NULL DEFAULT false,

        -- Costo total calculado (se actualiza al asignar/desasignar)
        total_cost_calculated DECIMAL(14,2) DEFAULT 0,
        active_assignments_count INTEGER DEFAULT 0,

        -- Auditoría
        created_by UUID REFERENCES auth.users(id),
        updated_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_tools_category ON tools.tools(category)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_tools_contract_status ON tools.tools(contract_status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_tools_cost_center ON tools.tools(cost_center)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_tools_next_renewal_date ON tools.tools(next_renewal_date)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS tools.tools`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS tools.tool_number_seq`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS tools RESTRICT`);
  }
}
