import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CreateKpiDto, CreateOkrDto, UpdateKpiDto, UpdateOkrDto } from './dto/job-position.dto';
import type { Actor } from './job-positions.service';
import {
  KPI_NOT_FOUND,
  OKR_NOT_FOUND,
  POSITION_NOT_FOUND,
  BASE_PERIOD,
  assertFrequency,
  assertPeriod,
  assertWeightSum,
  normalizeOkrPeriod,
  toKpiView,
  toOkrView,
  type KpiRow,
  type KpiView,
  type OkrRow,
  type OkrView,
} from './job-positions.util';

const OKR_COLS = 'id, job_position_id, period, objective_code, kr_code, objective, key_result, weight, sort_order, is_active';
const KPI_COLS = 'id, job_position_id, name, description, target_value, measurement_frequency, is_active';

type Q = { query: DataSource['query'] };

function firstRow<T>(result: unknown): T | undefined {
  if (!Array.isArray(result)) return undefined;
  const head = result[0];
  return (Array.isArray(head) ? head[0] : head) as T | undefined;
}

/** OKRs y KPIs base de un puesto. Toda escritura revalida en el servidor y deja auditoría explícita. */
@Injectable()
export class JobPositionItemsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  // ── Utilidades ─────────────────────────────────────────────────────────────

  /** Bloquea la fila del puesto (serializa las altas de OKRs de un mismo puesto) y la devuelve. */
  private async lockPosition(m: Q, positionId: string): Promise<{ id: string; code: string; title: string }> {
    const rows = (await m.query(
      `SELECT id, code, title FROM hr.job_positions WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [positionId],
    )) as { id: string; code: string; title: string }[];
    if (!rows[0]) throw new NotFoundException(POSITION_NOT_FOUND);
    return rows[0];
  }

  private async assertPositionExists(positionId: string): Promise<void> {
    const rows = (await this.dataSource.query(
      `SELECT 1 FROM hr.job_positions WHERE id = $1 AND deleted_at IS NULL`,
      [positionId],
    )) as unknown[];
    if (!rows[0]) throw new NotFoundException(POSITION_NOT_FOUND);
  }

  /** Pesos de los OKRs ACTIVOS y vivos del grupo de periodo (la plantilla, NULL, es su propio grupo), sin contar el que se guarda. */
  private async otherWeights(m: Q, positionId: string, period: string | null, excludeId: string | null): Promise<(number | null)[]> {
    const rows = (await m.query(
      `SELECT weight FROM hr.job_position_okrs
       WHERE job_position_id = $1 AND period IS NOT DISTINCT FROM $2::text AND deleted_at IS NULL AND is_active = true
         AND ($3::uuid IS NULL OR id <> $3::uuid)`,
      [positionId, period, excludeId],
    )) as { weight: string | null }[];
    return rows.map((r) => (r.weight === null ? null : Number(r.weight)));
  }

  private async log(
    action: 'create' | 'update' | 'delete',
    actor: Actor,
    entityType: 'job_position_okr' | 'job_position_kpi',
    entityId: string,
    entityName: string,
    changes: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.logActivity({
      userId: actor.id ?? null,
      userEmail: actor.email ?? null,
      userName: actor.name ?? null,
      action,
      module: 'matriz-puestos',
      entityType,
      entityId,
      entityName,
      changes,
    });
  }

  // ── OKRs ───────────────────────────────────────────────────────────────────

  async listOkrs(positionId: string, period?: string): Promise<OkrView[]> {
    await this.assertPositionExists(positionId);
    if (period && period !== BASE_PERIOD) assertPeriod(period);
    // Sin parámetro: todos; «base»: solo la plantilla (period NULL); AAAA-S1/S2: ese semestre.
    const rows = (await this.dataSource.query(
      `SELECT ${OKR_COLS} FROM hr.job_position_okrs
       WHERE job_position_id = $1 AND deleted_at IS NULL
         AND ($2::text IS NULL OR ($2 = 'base' AND period IS NULL) OR period = $2)
       ORDER BY period DESC NULLS FIRST, sort_order ASC, created_at ASC`,
      [positionId, period ?? null],
    )) as OkrRow[];
    return rows.map(toOkrView);
  }

  async createOkr(positionId: string, dto: CreateOkrDto, actor: Actor): Promise<OkrView> {
    const period = normalizeOkrPeriod(dto.period) ?? null;
    const { okr, position } = await this.dataSource.transaction(async (m) => {
      const position = await this.lockPosition(m, positionId);
      const weight = dto.weight ?? null;
      const active = dto.isActive ?? true;
      assertWeightSum(await this.otherWeights(m, positionId, period, null), weight, active);
      const rows = (await m.query(
        `INSERT INTO hr.job_position_okrs (job_position_id, period, objective_code, kr_code, objective, key_result, weight, sort_order, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${OKR_COLS}`,
        [positionId, period, dto.objectiveCode?.trim() || null, dto.krCode?.trim() || null, dto.objective.trim(), dto.keyResult.trim(), weight, dto.sortOrder ?? 0, active],
      )) as OkrRow[];
      return { okr: rows[0]!, position };
    });
    await this.log('create', actor, 'job_position_okr', okr.id, `${position.code} · ${okr.period ?? 'Plantilla'}`, {
      period: { from: null, to: okr.period },
      weight: { from: null, to: okr.weight },
    });
    return toOkrView(okr);
  }

  async updateOkr(okrId: string, dto: UpdateOkrDto, actor: Actor): Promise<OkrView> {
    const requestedPeriod = normalizeOkrPeriod(dto.period);
    const { before, after, position } = await this.dataSource.transaction(async (m) => {
      const found = (await m.query(
        `SELECT ${OKR_COLS} FROM hr.job_position_okrs WHERE id = $1 AND deleted_at IS NULL`,
        [okrId],
      )) as OkrRow[];
      if (!found[0]) throw new NotFoundException(OKR_NOT_FOUND);
      const position = await this.lockPosition(m, found[0].job_position_id);
      // Se relee bajo el candado del puesto para validar contra el estado vigente.
      const curRows = (await m.query(
        `SELECT ${OKR_COLS} FROM hr.job_position_okrs WHERE id = $1 AND deleted_at IS NULL`,
        [okrId],
      )) as OkrRow[];
      const cur = curRows[0];
      if (!cur) throw new NotFoundException(OKR_NOT_FOUND);

      const next = {
        period: requestedPeriod !== undefined ? requestedPeriod : cur.period,
        objectiveCode: dto.objectiveCode !== undefined ? (dto.objectiveCode?.trim() || null) : cur.objective_code,
        krCode: dto.krCode !== undefined ? (dto.krCode?.trim() || null) : cur.kr_code,
        objective: dto.objective?.trim() ?? cur.objective,
        keyResult: dto.keyResult?.trim() ?? cur.key_result,
        weight: dto.weight !== undefined ? dto.weight : cur.weight === null ? null : Number(cur.weight),
        sortOrder: dto.sortOrder ?? cur.sort_order,
        isActive: dto.isActive ?? cur.is_active,
      };
      assertWeightSum(await this.otherWeights(m, cur.job_position_id, next.period, okrId), next.weight, next.isActive);
      const rows = (await m.query(
        `UPDATE hr.job_position_okrs SET period=$2, objective=$3, key_result=$4, weight=$5, sort_order=$6,
           is_active=$7, objective_code=$8, kr_code=$9, updated_at=NOW()
         WHERE id=$1 AND deleted_at IS NULL RETURNING ${OKR_COLS}`,
        [okrId, next.period, next.objective, next.keyResult, next.weight, next.sortOrder, next.isActive, next.objectiveCode, next.krCode],
      )) as unknown;
      const after = firstRow<OkrRow>(rows);
      if (!after) throw new NotFoundException(OKR_NOT_FOUND);
      return { before: cur, after, position };
    });

    const diff: Record<string, { from: unknown; to: unknown }> = {};
    if (before.period !== after.period) diff.period = { from: before.period, to: after.period };
    if (Number(before.weight ?? -1) !== Number(after.weight ?? -1)) diff.weight = { from: before.weight, to: after.weight };
    if (before.is_active !== after.is_active) diff.isActive = { from: before.is_active, to: after.is_active };
    if (before.objective !== after.objective) diff.objective = { from: 'modificado', to: 'modificado' };
    if (before.key_result !== after.key_result) diff.keyResult = { from: 'modificado', to: 'modificado' };
    if (before.objective_code !== after.objective_code) diff.objectiveCode = { from: before.objective_code, to: after.objective_code };
    if (before.kr_code !== after.kr_code) diff.krCode = { from: before.kr_code, to: after.kr_code };
    await this.log('update', actor, 'job_position_okr', okrId, `${position.code} · ${after.period ?? 'Plantilla'}`, diff);
    return toOkrView(after);
  }

  async removeOkr(okrId: string, actor: Actor): Promise<void> {
    const hit = firstRow<{ id: string; period: string | null; job_position_id: string }>(
      await this.dataSource.query(
        `UPDATE hr.job_position_okrs SET deleted_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL RETURNING id, period, job_position_id`,
        [okrId],
      ),
    );
    if (!hit) throw new NotFoundException(OKR_NOT_FOUND);
    await this.log('delete', actor, 'job_position_okr', hit.id, `OKR ${hit.period ?? 'Plantilla'}`, {
      deleted: { from: false, to: true },
      jobPositionId: hit.job_position_id,
    });
  }

  // ── KPIs ───────────────────────────────────────────────────────────────────

  async listKpis(positionId: string): Promise<KpiView[]> {
    await this.assertPositionExists(positionId);
    const rows = (await this.dataSource.query(
      `SELECT ${KPI_COLS} FROM hr.job_position_kpis
       WHERE job_position_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC`,
      [positionId],
    )) as KpiRow[];
    return rows.map(toKpiView);
  }

  async createKpi(positionId: string, dto: CreateKpiDto, actor: Actor): Promise<KpiView> {
    assertFrequency(dto.measurementFrequency);
    const { kpi, position } = await this.dataSource.transaction(async (m) => {
      const position = await this.lockPosition(m, positionId);
      const rows = (await m.query(
        `INSERT INTO hr.job_position_kpis (job_position_id, name, description, target_value, measurement_frequency, is_active)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${KPI_COLS}`,
        [positionId, dto.name.trim(), dto.description ?? null, dto.targetValue ?? null, dto.measurementFrequency ?? null, dto.isActive ?? true],
      )) as KpiRow[];
      return { kpi: rows[0]!, position };
    });
    await this.log('create', actor, 'job_position_kpi', kpi.id, `${position.code} · ${kpi.name}`, {
      name: { from: null, to: kpi.name },
    });
    return toKpiView(kpi);
  }

  async updateKpi(kpiId: string, dto: UpdateKpiDto, actor: Actor): Promise<KpiView> {
    assertFrequency(dto.measurementFrequency);
    const cur = ((await this.dataSource.query(
      `SELECT ${KPI_COLS} FROM hr.job_position_kpis WHERE id = $1 AND deleted_at IS NULL`,
      [kpiId],
    )) as KpiRow[])[0];
    if (!cur) throw new NotFoundException(KPI_NOT_FOUND);

    const next = {
      name: dto.name?.trim() ?? cur.name,
      description: dto.description !== undefined ? dto.description : cur.description,
      targetValue: dto.targetValue !== undefined ? dto.targetValue : cur.target_value,
      frequency: dto.measurementFrequency !== undefined ? dto.measurementFrequency : cur.measurement_frequency,
      isActive: dto.isActive ?? cur.is_active,
    };
    const after = firstRow<KpiRow>(
      await this.dataSource.query(
        `UPDATE hr.job_position_kpis SET name=$2, description=$3, target_value=$4, measurement_frequency=$5,
           is_active=$6, updated_at=NOW()
         WHERE id=$1 AND deleted_at IS NULL RETURNING ${KPI_COLS}`,
        [kpiId, next.name, next.description, next.targetValue, next.frequency, next.isActive],
      ),
    );
    if (!after) throw new NotFoundException(KPI_NOT_FOUND);

    const diff: Record<string, { from: unknown; to: unknown }> = {};
    if (cur.name !== after.name) diff.name = { from: cur.name, to: after.name };
    if (cur.target_value !== after.target_value) diff.targetValue = { from: cur.target_value, to: after.target_value };
    if (cur.measurement_frequency !== after.measurement_frequency) {
      diff.measurementFrequency = { from: cur.measurement_frequency, to: after.measurement_frequency };
    }
    if (cur.is_active !== after.is_active) diff.isActive = { from: cur.is_active, to: after.is_active };
    if (cur.description !== after.description) diff.description = { from: 'modificada', to: 'modificada' };
    await this.log('update', actor, 'job_position_kpi', kpiId, after.name, diff);
    return toKpiView(after);
  }

  async removeKpi(kpiId: string, actor: Actor): Promise<void> {
    const hit = firstRow<{ id: string; name: string }>(
      await this.dataSource.query(
        `UPDATE hr.job_position_kpis SET deleted_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL RETURNING id, name`,
        [kpiId],
      ),
    );
    if (!hit) throw new NotFoundException(KPI_NOT_FOUND);
    await this.log('delete', actor, 'job_position_kpi', hit.id, hit.name, { deleted: { from: false, to: true } });
  }
}
