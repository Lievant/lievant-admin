import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Panel de administración de documentos del SGSI en ISOBOT.
 *
 * `file_size` y `deleted_at` no existían en isobot.documents: el grid del panel
 * muestra el tamaño y el borrado es lógico para que un documento retirado
 * conserve su historial en lugar de desaparecer de la tabla.
 *
 * La sección 'sgsi' es nueva. No se llama 'admin' a propósito: PermissionsGuard
 * reserva esa sección para SUPER_ADMIN y bloquea cualquier override individual,
 * lo que impediría delegar la administración del SGSI a un responsable de
 * calidad sin darle acceso a usuarios, roles y catálogos.
 */
export class AddSgsiIsobotAdmin1751000000013 implements MigrationInterface {
  name = 'AddSgsiIsobotAdmin1751000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE isobot.documents
        ADD COLUMN IF NOT EXISTS file_size INTEGER,
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_isobot_documents_macroprocess ON isobot.documents(macroprocess)`,
    );

    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES ('sgsi', 'isobot', 'write', 'Administrar documentos del SGSI en ISOBOT')
      ON CONFLICT (section, module, action) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM auth.roles r, auth.permissions p
      WHERE r.name = 'SUPER_ADMIN'
        AND p.section = 'sgsi' AND p.module = 'isobot' AND p.action = 'write'
        AND NOT EXISTS (
          SELECT 1 FROM auth.role_permissions rp
          WHERE rp.role_id = r.id AND rp.permission_id = p.id
        )
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (SELECT id FROM auth.permissions WHERE section = 'sgsi')
    `);
    await queryRunner.query(`DELETE FROM auth.permissions WHERE section = 'sgsi'`);
    await queryRunner.query(`DROP INDEX IF EXISTS isobot.idx_isobot_documents_macroprocess`);
    await queryRunner.query(`
      ALTER TABLE isobot.documents
        DROP COLUMN IF EXISTS file_size,
        DROP COLUMN IF EXISTS deleted_at
    `);
  }
}
