import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Categorías y subcategorías de tickets como catálogo administrable.
 *
 * Las tablas `helpdesk.categories` y `helpdesk.subcategories` ya existen y
 * tienen datos (9 categorías, 49 subcategorías); lo que faltaba era poder
 * editarlas sin una migración. Esta solo agrega los permisos y corrige un
 * hueco de datos.
 *
 * NO se añade FK de tickets.category hacia categories.slug. Son 141 tickets
 * con la categoría como texto y la integridad hoy está sana —las 7 categorías
 * en uso existen todas en el catálogo, y ninguna subcategoría de ticket está
 * fuera de él—, pero una FK impediría desactivar o renombrar una categoría que
 * ya tenga histórico, que es justo lo que la pantalla nueva necesita permitir.
 * El histórico conserva el texto con el que se levantó el ticket, que es lo
 * correcto para auditoría.
 *
 * El hueco de datos: el servicio calculaba la prioridad con un diccionario
 * hardcodeado que no incluía 'altas_bajas', así que esos tickets caían a P3 en
 * lugar de su P2. Al pasar a leer priority_base de la tabla, el caso se
 * resuelve solo; aquí únicamente se verifica que los valores de la tabla
 * coincidan con los que el diccionario venía aplicando, para que el cambio no
 * altere en silencio la prioridad de ninguna categoría en uso.
 */
export class AddHelpdeskCatalogues1751000000025 implements MigrationInterface {
  name = 'AddHelpdeskCatalogues1751000000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Permisos de administración ──────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO auth.permissions (section, module, action, description)
      VALUES
        ('admin', 'helpdesk-categorias', 'read', 'Ver categorías de tickets'),
        ('admin', 'helpdesk-categorias', 'write',
         'Gestionar categorías y subcategorías de tickets')
      ON CONFLICT (section, module, action) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO auth.role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM auth.roles r, auth.permissions p
      WHERE r.name IN ('SUPER_ADMIN', 'DIRECTOR')
        AND p.section = 'admin' AND p.module = 'helpdesk-categorias'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);

    // ── Integridad del catálogo ─────────────────────────────────────────────
    // priority_base pasa a ser la fuente de verdad de la prioridad. Cualquier
    // categoría sin valor quedaría en P3 por el fallback del servicio; se
    // rellena explícitamente para que el dato viva en la tabla y no en el
    // código.
    await queryRunner.query(`
      UPDATE helpdesk.categories
      SET priority_base = 'P3'
      WHERE priority_base IS NULL OR priority_base = ''
    `);

    // Dos subcategorías con el mismo nombre dentro de la misma categoría son
    // indistinguibles en el formulario de ticket. Este índice es además el que
    // sirve los filtros por category_slug: al ser btree, su prefijo izquierdo
    // cubre esa consulta sin necesidad de un segundo índice.
    //
    // No se crea índice único sobre categories(slug): la columna ya se declaró
    // UNIQUE al crear la tabla y Postgres mantiene categories_slug_key. Uno
    // nuevo sería un duplicado exacto, con su costo de escritura y cero
    // beneficio.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_helpdesk_subcategories_cat_name
        ON helpdesk.subcategories(category_slug, name)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS helpdesk.uq_helpdesk_subcategories_cat_name`);

    await queryRunner.query(`
      DELETE FROM auth.role_permissions
      WHERE permission_id IN (
        SELECT id FROM auth.permissions
        WHERE section = 'admin' AND module = 'helpdesk-categorias'
      )
    `);
    await queryRunner.query(`
      DELETE FROM auth.permissions
      WHERE section = 'admin' AND module = 'helpdesk-categorias'
    `);
  }
}
