import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { MAX_UPLOAD_BYTES, assertKeyInPrefix, assertUploadAllowed } from '../../common/s3-upload.util';
import { AuditService } from '../audit/audit.service';
import { CertificateRefDto, CertificateUploadDto, CreateTrainingDto, UpdateTrainingDto } from './dto/training.dto';
import { EmployeeStorageService } from './employee-storage.service';
import {
  ALLOWED_CERTIFICATE_MIME_TYPES,
  TRAINING_COLUMNS,
  TRAINING_NOT_FOUND,
  buildTrainingFilter,
  firstReturnedRow,
  toMyTrainingView,
  toTrainingView,
  trainingPrefix,
  validateTraining,
  type DurationUnit,
  type MyTrainingView,
  type TrainingFilters,
  type TrainingRow,
  type TrainingView,
} from './trainings.util';

export interface TrainingActor {
  id?: string;
  email?: string;
  name?: string;
}

/** Vida de la URL de descarga del certificado: corta, se pide al momento. */
export const CERTIFICATE_URL_TTL_SECONDS = 300;

/**
 * Capacitaciones del colaborador. Toda consulta va acotada por `employee_id`
 * Y `deleted_at IS NULL`: una capacitación de otro empleado, o dada de baja,
 * responde "no encontrada" igual que si no existiera.
 */
@Injectable()
export class TrainingsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly storage: EmployeeStorageService,
    private readonly audit: AuditService,
  ) {}

  private async assertEmployee(employeeId: string): Promise<{ id: string; full_name: string }> {
    const rows = (await this.dataSource.query(
      `SELECT id, full_name FROM employees.employee_records WHERE id = $1 AND deleted_at IS NULL`,
      [employeeId],
    )) as { id: string; full_name: string }[];
    if (!rows[0]) throw new NotFoundException('Expediente no encontrado');
    return rows[0];
  }

  private async findRow(employeeId: string, trainingId: string): Promise<TrainingRow> {
    const rows = (await this.dataSource.query(
      `SELECT ${TRAINING_COLUMNS} FROM employees.employee_trainings
       WHERE id = $1 AND employee_id = $2 AND deleted_at IS NULL`,
      [trainingId, employeeId],
    )) as TrainingRow[];
    if (!rows[0]) throw new NotFoundException(TRAINING_NOT_FOUND);
    return rows[0];
  }

  private async listRows(employeeId: string, filters: TrainingFilters): Promise<TrainingRow[]> {
    const { where, params } = buildTrainingFilter(employeeId, filters);
    return (await this.dataSource.query(
      `SELECT ${TRAINING_COLUMNS} FROM employees.employee_trainings
       WHERE ${where}
       ORDER BY start_date DESC, created_at DESC`,
      params,
    )) as TrainingRow[];
  }

  /** Vista de RRHH. */
  async list(employeeId: string, filters: TrainingFilters): Promise<TrainingView[]> {
    await this.assertEmployee(employeeId);
    return (await this.listRows(employeeId, filters)).map(toTrainingView);
  }

  /** Vista del colaborador sobre SU expediente (el id ya viene resuelto desde la sesión). */
  async listMine(employeeId: string, filters: TrainingFilters): Promise<MyTrainingView[]> {
    return (await this.listRows(employeeId, filters)).map(toMyTrainingView);
  }

  /** Paso 1 del certificado: valida tipo y tamaño declarados y firma la URL de subida. */
  async createCertificateUpload(
    employeeId: string,
    dto: CertificateUploadDto,
  ): Promise<{ uploadUrl: string; s3Key: string }> {
    await this.assertEmployee(employeeId);
    assertUploadAllowed(dto.fileType, dto.fileSize, ALLOWED_CERTIFICATE_MIME_TYPES);
    return this.storage.getPresignedUploadUrlForPrefix(dto.fileName, dto.fileType, trainingPrefix(employeeId));
  }

  /** Paso 3: revalida tipo, pertenencia de la key y el tamaño REAL del objeto subido. */
  private async verifyCertificate(employeeId: string, ref: CertificateRefDto): Promise<void> {
    assertUploadAllowed(ref.fileType, ref.fileSize, ALLOWED_CERTIFICATE_MIME_TYPES);
    assertKeyInPrefix(ref.s3Key, trainingPrefix(employeeId));
    const actual = await this.storage.getObjectSize(ref.s3Key);
    if (actual === null) throw new BadRequestException('El archivo no se encontró en el almacenamiento');
    if (actual > MAX_UPLOAD_BYTES) {
      await this.storage.deleteDocument(ref.s3Key);
      throw new BadRequestException(
        `El archivo no puede superar ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`,
      );
    }
  }

  async create(employeeId: string, dto: CreateTrainingDto, actor: TrainingActor): Promise<TrainingView> {
    const employee = await this.assertEmployee(employeeId);
    const state = {
      developmentType: dto.developmentType,
      level: dto.level ?? null,
      startDate: dto.startDate,
      endDate: dto.endDate ?? null,
      durationValue: dto.durationValue ?? null,
      durationUnit: (dto.durationUnit ?? null) as DurationUnit | null,
    };
    validateTraining(state);
    if (dto.certificate) await this.verifyCertificate(employeeId, dto.certificate);

    const rows = (await this.dataSource.query(
      `INSERT INTO employees.employee_trainings
         (employee_id, name, institution, development_type, level, start_date, end_date,
          duration_value, duration_unit, is_company_recognition,
          certificate_s3_key, certificate_original_name, notes, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)
       RETURNING ${TRAINING_COLUMNS}`,
      [
        employeeId,
        dto.name.trim(),
        dto.institution.trim(),
        state.developmentType,
        state.level,
        state.startDate,
        state.endDate,
        state.durationValue,
        state.durationUnit,
        dto.isCompanyRecognition ?? false,
        dto.certificate?.s3Key ?? null,
        dto.certificate?.fileName ?? null,
        dto.notes ?? null,
        actor.id ?? null,
      ],
    )) as TrainingRow[];
    const row = rows[0]!;
    await this.logAudit('create', actor, row, employee.full_name, { name: { from: null, to: row.name } });
    return toTrainingView(row);
  }

  async update(
    employeeId: string,
    trainingId: string,
    dto: UpdateTrainingDto,
    actor: TrainingActor,
  ): Promise<TrainingView> {
    const employee = await this.assertEmployee(employeeId);
    const current = await this.findRow(employeeId, trainingId);

    const merged = {
      name: dto.name?.trim() ?? current.name,
      institution: dto.institution?.trim() ?? current.institution,
      developmentType: dto.developmentType ?? current.development_type,
      level: dto.level !== undefined ? dto.level : current.level,
      startDate: dto.startDate ?? current.start_date,
      endDate: dto.endDate !== undefined ? dto.endDate : current.end_date,
      durationValue: dto.durationValue !== undefined ? dto.durationValue : current.duration_value,
      durationUnit: (dto.durationUnit !== undefined ? dto.durationUnit : current.duration_unit) as DurationUnit | null,
      isCompanyRecognition: dto.isCompanyRecognition ?? current.is_company_recognition,
      notes: dto.notes !== undefined ? dto.notes : current.notes,
    };
    validateTraining(merged);

    let certKey = current.certificate_s3_key;
    let certName = current.certificate_original_name;
    let oldKeyToDelete: string | null = null;
    if (dto.certificate !== undefined) {
      if (dto.certificate === null) {
        oldKeyToDelete = current.certificate_s3_key;
        certKey = null;
        certName = null;
      } else if (dto.certificate.s3Key !== current.certificate_s3_key) {
        await this.verifyCertificate(employeeId, dto.certificate);
        oldKeyToDelete = current.certificate_s3_key;
        certKey = dto.certificate.s3Key;
        certName = dto.certificate.fileName;
      }
    }

    const rows: unknown = await this.dataSource.query(
      `UPDATE employees.employee_trainings SET
         name = $3, institution = $4, development_type = $5, level = $6, start_date = $7, end_date = $8,
         duration_value = $9, duration_unit = $10, is_company_recognition = $11, notes = $12,
         certificate_s3_key = $13, certificate_original_name = $14, updated_by = $15, updated_at = NOW()
       WHERE id = $1 AND employee_id = $2 AND deleted_at IS NULL
       RETURNING ${TRAINING_COLUMNS}`,
      [
        trainingId,
        employeeId,
        merged.name,
        merged.institution,
        merged.developmentType,
        merged.level,
        merged.startDate,
        merged.endDate,
        merged.durationValue,
        merged.durationUnit,
        merged.isCompanyRecognition,
        merged.notes,
        certKey,
        certName,
        actor.id ?? null,
      ],
    );
    const row = firstReturnedRow<TrainingRow>(rows);
    if (!row) throw new NotFoundException(TRAINING_NOT_FOUND);

    // El archivo reemplazado o retirado ya no lo referencia ninguna fila viva.
    if (oldKeyToDelete) await this.storage.deleteDocument(oldKeyToDelete);

    await this.logAudit('update', actor, row, employee.full_name, this.diff(current, row));
    return toTrainingView(row);
  }

  /** Baja lógica: la fila y su certificado quedan, pero ya no se listan ni se descargan. */
  async remove(employeeId: string, trainingId: string, actor: TrainingActor): Promise<void> {
    const employee = await this.assertEmployee(employeeId);
    const rows: unknown = await this.dataSource.query(
      `UPDATE employees.employee_trainings
       SET deleted_at = NOW(), updated_by = $3, updated_at = NOW()
       WHERE id = $1 AND employee_id = $2 AND deleted_at IS NULL
       RETURNING ${TRAINING_COLUMNS}`,
      [trainingId, employeeId, actor.id ?? null],
    );
    const row = firstReturnedRow<TrainingRow>(rows);
    if (!row) throw new NotFoundException(TRAINING_NOT_FOUND);
    await this.logAudit('delete', actor, row, employee.full_name, { name: { from: row.name, to: null } });
  }

  /** URL prefirmada de corta vida. Una capacitación borrada, ajena o sin certificado: 404. */
  async getCertificateUrl(employeeId: string, trainingId: string): Promise<{ url: string; fileName: string | null }> {
    const row = await this.findRow(employeeId, trainingId);
    if (!row.certificate_s3_key) throw new NotFoundException('La capacitación no tiene certificado');
    return {
      url: await this.storage.getPresignedUrl(row.certificate_s3_key, CERTIFICATE_URL_TTL_SECONDS),
      fileName: row.certificate_original_name,
    };
  }

  private diff(before: TrainingRow, after: TrainingRow): Record<string, { from: unknown; to: unknown }> {
    const fields: (keyof TrainingRow)[] = [
      'name', 'institution', 'development_type', 'level', 'start_date', 'end_date', 'duration_value',
      'duration_unit', 'is_company_recognition', 'notes', 'certificate_original_name',
    ];
    const out: Record<string, { from: unknown; to: unknown }> = {};
    for (const f of fields) {
      if (before[f] !== after[f]) out[f] = { from: before[f], to: after[f] };
    }
    return out;
  }

  /**
   * El interceptor global no cubre la ruta de empleados (su módulo es 'employees',
   * no 'empleados'), así que altas, cambios y bajas se registran de forma explícita.
   * No se guardan llaves de S3 ni el contenido de las notas.
   */
  private async logAudit(
    action: 'create' | 'update' | 'delete',
    actor: TrainingActor,
    row: TrainingRow,
    employeeName: string,
    changes: Record<string, unknown>,
  ): Promise<void> {
    const safe = { ...changes };
    delete safe.notes;
    await this.audit.logActivity({
      userId: actor.id ?? null,
      userEmail: actor.email ?? null,
      userName: actor.name ?? null,
      action,
      module: 'empleados',
      entityType: 'employee_training',
      entityId: row.id,
      entityName: `${row.name} — ${employeeName}`,
      changes: { employeeId: row.employee_id, ...safe },
    });
  }
}
