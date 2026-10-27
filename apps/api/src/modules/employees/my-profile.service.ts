import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeStorageService } from './employee-storage.service';
import { EmployeeDocument } from './entities/employee-document.entity';
import { EmployeeRecord } from './entities/employee-record.entity';
import { PersonalData } from './entities/personal-data.entity';
import { TrainingsService } from './trainings.service';
import type { MyTrainingView, TrainingFilters } from './trainings.util';
import {
  EMPLOYEE_NOT_LINKED,
  EMPLOYEE_NOT_LINKED_MESSAGE,
  HIDDEN_DOCUMENT_TYPES,
  toMyDocument,
  toMyProfile,
  type MyDocument,
  type MyProfile,
} from './my-profile.util';

export interface MyEquipmentItem {
  id: string;
  displayId: string;
  legacyId: string | null;
  equipmentType: string;
  brand: string | null;
  model: string | null;
  status: string;
}

export interface MyToolAssignment {
  id: string;
  assignmentCode: string;
  status: string;
  toolName: string;
}

/**
 * Mi Información (solo lectura). El empleado SIEMPRE sale de la sesión
 * (`auth_user_id` del usuario del JWT): ningún método recibe el id de un
 * empleado desde el cliente, así que no hay forma de pedir el de otra persona.
 */
@Injectable()
export class MyProfileService {
  constructor(
    @InjectRepository(EmployeeRecord) private readonly employeesRepo: Repository<EmployeeRecord>,
    @InjectRepository(PersonalData) private readonly personalRepo: Repository<PersonalData>,
    @InjectRepository(EmployeeDocument) private readonly documentsRepo: Repository<EmployeeDocument>,
    private readonly storage: EmployeeStorageService,
    private readonly trainings: TrainingsService,
  ) {}

  /** Expediente vivo ligado al usuario; 404 con código identificable si no hay. */
  async resolveEmployee(userId: string): Promise<EmployeeRecord> {
    // `findOne` excluye los expedientes dados de baja lógicamente (deleted_at).
    const employee = await this.employeesRepo.findOne({ where: { authUserId: userId } });
    if (!employee) {
      throw new NotFoundException({
        statusCode: 404,
        code: EMPLOYEE_NOT_LINKED,
        message: EMPLOYEE_NOT_LINKED_MESSAGE,
      });
    }
    return employee;
  }

  async getProfile(userId: string): Promise<MyProfile> {
    const employee = await this.resolveEmployee(userId);
    const personal = await this.personalRepo.findOne({ where: { employeeId: employee.id } });
    return toMyProfile(employee, personal);
  }

  /** Documentos propios, sin URL: la descarga se pide aparte, documento por documento. */
  async listDocuments(userId: string): Promise<MyDocument[]> {
    const employee = await this.resolveEmployee(userId);
    const docs = await this.documentsRepo.find({
      where: { employeeId: employee.id },
      order: { uploadedAt: 'DESC' },
    });
    return docs.filter((d) => !HIDDEN_DOCUMENT_TYPES.includes(d.type)).map(toMyDocument);
  }

  /**
   * URL prefirmada de un documento PROPIO. Un id ajeno, borrado o de un tipo
   * oculto responde 404 (no 403), para no revelar que existe.
   */
  async getDocumentUrl(userId: string, docId: string): Promise<{ url: string }> {
    const employee = await this.resolveEmployee(userId);
    const doc = await this.documentsRepo.findOne({ where: { id: docId, employeeId: employee.id } });
    if (!doc || HIDDEN_DOCUMENT_TYPES.includes(doc.type)) {
      throw new NotFoundException('Documento no encontrado');
    }
    return { url: await this.storage.getPresignedUrl(doc.s3Key) };
  }

  /** Capacitaciones propias (lista blanca: sin notas de RRHH ni llaves de S3). */
  async getTrainings(userId: string, filters: TrainingFilters): Promise<MyTrainingView[]> {
    const employee = await this.resolveEmployee(userId);
    return this.trainings.listMine(employee.id, filters);
  }

  /** Certificado de una capacitación PROPIA; una ajena o borrada responde 404. */
  async getTrainingCertificateUrl(userId: string, trainingId: string): Promise<{ url: string }> {
    const employee = await this.resolveEmployee(userId);
    const { url } = await this.trainings.getCertificateUrl(employee.id, trainingId);
    return { url };
  }

  /** Equipos y herramientas/licencias asignados al colaborador, solo para verlos. */
  async getEquipment(userId: string): Promise<{ equipment: MyEquipmentItem[]; tools: MyToolAssignment[] }> {
    const employee = await this.resolveEmployee(userId);

    const equipment = (await this.employeesRepo.query(
      `SELECT id, display_id, legacy_id, equipment_type, brand, model, status
       FROM inventory.equipment
       WHERE assigned_to_employee_id = $1 AND deleted_at IS NULL
       ORDER BY equipment_type ASC, brand ASC`,
      [employee.id],
    )) as {
      id: string;
      display_id: string;
      legacy_id: string | null;
      equipment_type: string;
      brand: string | null;
      model: string | null;
      status: string;
    }[];

    // Solo código, nombre y estado de la herramienta: nada de costos ni contratos.
    const tools = (await this.employeesRepo.query(
      `SELECT a.id, a.assignment_code, a.status, t.name AS tool_name
       FROM tools.assignments a
       JOIN tools.tools t ON t.id = a.tool_id
       WHERE a.employee_id = $1 AND a.deleted_at IS NULL
       ORDER BY a.assignment_date DESC`,
      [employee.id],
    )) as { id: string; assignment_code: string; status: string; tool_name: string }[];

    return {
      equipment: equipment.map((e) => ({
        id: e.id,
        displayId: e.display_id,
        legacyId: e.legacy_id,
        equipmentType: e.equipment_type,
        brand: e.brand,
        model: e.model,
        status: e.status,
      })),
      tools: tools.map((t) => ({ id: t.id, assignmentCode: t.assignment_code, status: t.status, toolName: t.tool_name })),
    };
  }
}
