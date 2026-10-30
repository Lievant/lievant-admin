import { ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CatalogsModule } from '../catalogs.module';
import { CatalogsController } from '../catalogs.controller';
import { CompetenciesController } from './competencies.controller';
import { CreateCompetencyDto, UpdateCompetencyDto } from './competencies.dto';
import { CompetenciesService } from './competencies.service';
import { FakeCompetencyRepo } from './competencies-fake';
import { cleanName, nameKey } from './competencies.util';

function build() {
  const repo = new FakeCompetencyRepo();
  const service = new CompetenciesService(repo as never);
  return { repo, service };
}

describe('Competencias · alta', () => {
  it('crea con nombre, descripción y orden; sin descripción ni orden quedan null y 0, y nace activa', async () => {
    const { service } = build();
    const a = await service.create({ name: 'TEST-Liderazgo', description: 'Guía al equipo', sortOrder: 3 });
    expect(a).toMatchObject({ name: 'TEST-Liderazgo', description: 'Guía al equipo', sortOrder: 3, isActive: true });
    const b = await service.create({ name: 'TEST-Comunicación' });
    expect(b).toMatchObject({ description: null, sortOrder: 0, isActive: true });
    expect(a).not.toHaveProperty('deletedAt');
  });

  it('recorta el nombre y colapsa los espacios múltiples; una descripción vacía es null', async () => {
    const { service } = build();
    const a = await service.create({ name: '  TEST-Trabajo   en    equipo ', description: '   ' });
    expect(a.name).toBe('TEST-Trabajo en equipo');
    expect(a.description).toBeNull();
  });

  it('rechaza un nombre repetido: también con otras mayúsculas, acentos y espacios', async () => {
    const { service } = build();
    await service.create({ name: 'TEST-Comunicación Efectiva' });
    for (const dup of ['test-comunicación efectiva', 'TEST-COMUNICACION EFECTIVA', '  TEST-Comunicación    Efectiva  ']) {
      await expect(service.create({ name: dup })).rejects.toBeInstanceOf(ConflictException);
    }
  });

  it('un nombre en blanco no se acepta', async () => {
    const { service } = build();
    await expect(service.create({ name: '   ' })).rejects.toThrow(/obligatorio/);
  });

  it('traduce el choque del índice único (alta simultánea) en un 409', async () => {
    const { service, repo } = build();
    repo.failOnSave = () => Object.assign(new Error('duplicate key'), { code: '23505' });
    await expect(service.create({ name: 'TEST-X' })).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('Competencias · edición, activar y desactivar', () => {
  it('edita nombre, descripción y orden; puede borrar la descripción', async () => {
    const { service } = build();
    const a = await service.create({ name: 'TEST-A', description: 'd', sortOrder: 1 });
    const edited = await service.update(a.id, { name: 'TEST-A2', description: '', sortOrder: 9 });
    expect(edited).toMatchObject({ name: 'TEST-A2', description: null, sortOrder: 9 });
  });

  it('conservar el mismo nombre (aunque cambie la capitalización) no es un duplicado de sí misma', async () => {
    const { service } = build();
    const a = await service.create({ name: 'TEST-Nombre' });
    await expect(service.update(a.id, { name: 'TEST-NOMBRE' })).resolves.toMatchObject({ name: 'TEST-NOMBRE' });
  });

  it('no deja renombrar con el nombre de otra', async () => {
    const { service } = build();
    await service.create({ name: 'TEST-Uno' });
    const b = await service.create({ name: 'TEST-Dos' });
    await expect(service.update(b.id, { name: 'test-uno' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('desactivar (DELETE) y activar (isActive: true); /active solo trae las activas', async () => {
    const { service } = build();
    const a = await service.create({ name: 'TEST-A' });
    await service.create({ name: 'TEST-B' });
    await service.deactivate(a.id);
    expect((await service.findActive()).map((c) => c.name)).toEqual(['TEST-B']);
    expect((await service.findAll()).map((c) => c.name).sort()).toEqual(['TEST-A', 'TEST-B']);
    await service.update(a.id, { isActive: true });
    expect((await service.findActive()).map((c) => c.name).sort()).toEqual(['TEST-A', 'TEST-B']);
  });

  it('editar o desactivar una que no existe es 404', async () => {
    const { service } = build();
    await expect(service.update('00000000-0000-4000-8000-0000000000ff', { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.deactivate('00000000-0000-4000-8000-0000000000ff')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('Competencias · eliminación lógica', () => {
  it('una eliminada no aparece en la lista ni en /active, y ya no se puede editar', async () => {
    const { service, repo } = build();
    const a = await service.create({ name: 'TEST-A' });
    await service.create({ name: 'TEST-B' });
    await service.remove(a.id);
    expect((await service.findAll()).map((c) => c.name)).toEqual(['TEST-B']);
    expect((await service.findActive()).map((c) => c.name)).toEqual(['TEST-B']);
    expect(repo.rows.find((r) => r.id === a.id)!.deletedAt).toBeInstanceOf(Date); // el registro sigue (borrado lógico)
    await expect(service.update(a.id, { name: 'TEST-A2' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(a.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('se puede recrear una eliminada con el mismo nombre', async () => {
    const { service } = build();
    const a = await service.create({ name: 'TEST-Recrear' });
    await service.remove(a.id);
    const again = await service.create({ name: 'test-recrear' });
    expect(again.id).not.toBe(a.id);
    expect((await service.findAll()).map((c) => c.name)).toEqual(['test-recrear']);
  });
});

describe('Competencias · lista', () => {
  it('ordena por orden y luego por nombre', async () => {
    const { service } = build();
    await service.create({ name: 'TEST-C', sortOrder: 2 });
    await service.create({ name: 'TEST-B', sortOrder: 1 });
    await service.create({ name: 'TEST-A', sortOrder: 1 });
    await service.create({ name: 'TEST-Z', sortOrder: 0 });
    expect((await service.findAll()).map((c) => c.name)).toEqual(['TEST-Z', 'TEST-A', 'TEST-B', 'TEST-C']);
  });
});

describe('Competencias · DTO', () => {
  const strict = { whitelist: true, forbidNonWhitelisted: true };
  it('nombre obligatorio de hasta 150, descripción de hasta 1000 y orden entero de 0 a 32767', async () => {
    expect(await validate(plainToInstance(CreateCompetencyDto, { name: 'TEST-OK' }), strict)).toHaveLength(0);
    expect((await validate(plainToInstance(CreateCompetencyDto, {}), strict)).map((e) => e.property)).toEqual(['name']);
    expect((await validate(plainToInstance(CreateCompetencyDto, { name: 'x'.repeat(151) }), strict)).map((e) => e.property)).toEqual(['name']);
    expect((await validate(plainToInstance(CreateCompetencyDto, { name: 'a', description: 'x'.repeat(1001) }), strict)).map((e) => e.property)).toEqual(['description']);
    expect(await validate(plainToInstance(CreateCompetencyDto, { name: 'a', description: 'x'.repeat(1000) }), strict)).toHaveLength(0);
    for (const bad of [-1, 32768, 1.5]) {
      expect((await validate(plainToInstance(CreateCompetencyDto, { name: 'a', sortOrder: bad }), strict)).map((e) => e.property)).toEqual(['sortOrder']);
    }
    expect(await validate(plainToInstance(UpdateCompetencyDto, { isActive: false }), strict)).toHaveLength(0);
  });

  it('no acepta campos que no son suyos', async () => {
    expect((await validate(plainToInstance(CreateCompetencyDto, { name: 'a', code: 'X' }), strict)).map((e) => e.property)).toEqual(['code']);
  });
});

describe('Competencias · utilidades', () => {
  it('cleanName y nameKey ignoran mayúsculas, acentos y espacios extra', () => {
    expect(cleanName('  a   b ')).toBe('a b');
    expect(nameKey('  Comunicación   EFECTIVA ')).toBe('comunicacion efectiva');
  });
});

describe('Competencias · rutas y protección', () => {
  it('su controlador va ANTES que el genérico en el módulo, para que no lo tape catalogs/:entity', () => {
    const controllers = Reflect.getMetadata('controllers', CatalogsModule) as unknown[];
    expect(controllers.indexOf(CompetenciesController)).toBeGreaterThanOrEqual(0);
    expect(controllers.indexOf(CompetenciesController)).toBeLessThan(controllers.indexOf(CatalogsController));
  });

  it('SUPER_ADMIN para administrar; /active solo con sesión; eliminar tiene ruta propia (:id/remove)', () => {
    const proto = CompetenciesController.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
    const roles = (name: string) => Reflect.getMetadata('roles', proto[name]!) as string[] | undefined;
    for (const m of ['findAll', 'create', 'update', 'deactivate', 'remove']) expect(roles(m)).toEqual(['SUPER_ADMIN']);
    expect(roles('findActive')).toBeUndefined();
    expect(Reflect.getMetadata('path', proto.remove!)).toBe(':id/remove');
    expect(Reflect.getMetadata('path', proto.deactivate!)).toBe(':id');
  });
});

describe('Migración 047 · catálogo de competencias', () => {
  const src = readFileSync(join(__dirname, '../../../database/migrations/1751000000047-CreateCompetenciesCatalog.ts'), 'utf8');
  it('es aditiva e idempotente, con el índice único parcial y sin datos semilla', () => {
    expect(src).toMatch(/CREATE TABLE IF NOT EXISTS catalogs\.competencies/);
    expect(src).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_competencies_name[\s\S]*lower\(btrim\(name\)\)\) WHERE deleted_at IS NULL/);
    expect(src).toMatch(/CREATE INDEX IF NOT EXISTS idx_catalog_competencies_active/);
    expect(src).not.toMatch(/INSERT INTO/);
  });
  it('down() revierte todo', () => {
    expect(src).toMatch(/DROP TABLE IF EXISTS catalogs\.competencies/);
    expect(src).toMatch(/DROP INDEX IF EXISTS catalogs\.uq_catalog_competencies_name/);
  });
});
