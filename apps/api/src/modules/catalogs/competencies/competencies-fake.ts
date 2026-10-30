/** Repositorio, DataSource y auditoría en memoria para las pruebas del catálogo de Competencias (sin base de datos). */
import { CatalogCompetency } from '../entities/catalog-competency.entity';

let seq = 0;

export class FakeCompetencyRepo {
  rows: CatalogCompetency[] = [];
  /** Hace que el siguiente save falle con este error (para probar el todo-o-nada). */
  failOnSave: ((c: CatalogCompetency) => Error | null) | null = null;

  create(data: Partial<CatalogCompetency>): CatalogCompetency {
    return Object.assign(new CatalogCompetency(), { description: null, deletedAt: null, isActive: true, sortOrder: 0, ...data });
  }

  async save(c: CatalogCompetency): Promise<CatalogCompetency> {
    const err = this.failOnSave?.(c);
    if (err) throw err;
    if (!c.id) {
      seq += 1;
      c.id = `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
      c.createdAt = new Date();
      this.rows.push(c);
    }
    c.updatedAt = new Date();
    return c;
  }

  async find(opts: { where?: { isActive?: boolean }; order?: unknown; withDeleted?: boolean } = {}): Promise<CatalogCompetency[]> {
    let out = this.rows.filter((r) => opts.withDeleted || !r.deletedAt);
    if (opts.where?.isActive !== undefined) out = out.filter((r) => r.isActive === opts.where!.isActive);
    return [...out].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  async findOne(opts: { where: { id: string } }): Promise<CatalogCompetency | null> {
    return this.rows.find((r) => r.id === opts.where.id && !r.deletedAt) ?? null;
  }

  getRepository(): FakeCompetencyRepo {
    return this;
  }
}

/** DataSource mínimo: `transaction` revierte (restaura el estado) si el callback falla. */
export class FakeDataSource {
  constructor(public readonly repo: FakeCompetencyRepo) {}

  get manager() {
    return { getRepository: () => this.repo };
  }

  async transaction<T>(cb: (m: { getRepository: () => FakeCompetencyRepo }) => Promise<T>): Promise<T> {
    const snapshot = this.repo.rows.map((r) => ({ ref: r, copy: { ...r } }));
    const before = [...this.repo.rows];
    try {
      return await cb(this.manager);
    } catch (e) {
      this.repo.rows = before;
      for (const s of snapshot) Object.assign(s.ref, s.copy);
      throw e;
    }
  }
}
