import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Asegura que `catalogs.org_levels` tenga los niveles V a IX de la escala oficial.
 *
 * La 042 ya los agrega, pero existen bases donde corrió una versión anterior de esa migración; esta los deja
 * garantizados sin editar la 042. Solo inserta los que faltan (`ON CONFLICT (code) DO NOTHING`): I a IV y los
 * niveles que ya existen no se tocan ni se renombran. En una base que ya los tiene no cambia nada.
 *
 * `down()` no borra nada: los niveles pueden estar en uso por empleados y puestos.
 */
export class EnsureOrgLevelsVToIX1751000000046 implements MigrationInterface {
  name = 'EnsureOrgLevelsVToIX1751000000046';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO catalogs.org_levels (code, name, sort_order)
      VALUES ('V', 'Especialista Senior / Key Account', 4),
             ('VI', 'Senior', 5),
             ('VII', 'Semi Senior', 6),
             ('VIII', 'Junior / Auxiliar', 7),
             ('IX', 'Practicante / Trainee', 8)
      ON CONFLICT (code) DO NOTHING
    `);
  }

  public async down(): Promise<void> {
    // Intencionalmente vacío: no se borran niveles del catálogo.
  }
}
