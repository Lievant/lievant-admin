import type { EmployeeRecord } from './entities/employee-record.entity';
import type { PersonalData } from './entities/personal-data.entity';

/**
 * Mi Información: lo que el colaborador puede ver de su propio expediente.
 *
 * Es una LISTA BLANCA: cada campo se copia a mano. Nada de remuneración
 * (`employees.compensation`), notas internas, datos de baja ni la relación con el
 * usuario de acceso. Si el expediente gana columnas nuevas, no aparecen aquí hasta
 * que alguien las agregue a propósito.
 */

/** Tipos de documento que no se muestran al colaborador. Vacío: se ven todos. */
export const HIDDEN_DOCUMENT_TYPES: readonly string[] = [];

export const EMPLOYEE_NOT_LINKED = 'EMPLOYEE_NOT_LINKED';
export const EMPLOYEE_NOT_LINKED_MESSAGE =
  'Tu usuario no está vinculado a un expediente de empleado. Escríbele a RRHH: rrhh@lievant.com';

export interface MyLaboral {
  displayId: string;
  codNom: string | null;
  status: string;
  position: string;
  level: string | null;
  project: string | null;
  companyName: string;
  companyCode: string;
  division: string | null;
  area: string | null;
  directReportTo: string | null;
  location: string | null;
  modality: string | null;
  contractSchema: string | null;
  corporateEmail: string | null;
  emailSignature: string | null;
  seniorityDate: string | null;
  contractType: string | null;
  contractEndDate: string | null;
  schedule: string | null;
  lunchTime: string | null;
  gender: string | null;
  nationality: string | null;
  studies: string | null;
}

export interface MyPersonal {
  rfc: string | null;
  curp: string | null;
  imssNumber: string | null;
  bloodType: string | null;
  birthDate: string | null;
  maritalStatus: string | null;
  children: number | null;
  phone: string | null;
  mainTransport: string | null;
  commuteTime: string | null;
  street: string | null;
  extNumber: string | null;
  intNumber: string | null;
  neighborhood: string | null;
  postalCode: string | null;
  city: string | null;
  state: string | null;
}

export interface MyProfile {
  fullName: string;
  laboral: MyLaboral;
  personal: MyPersonal | null;
}

export function toMyLaboral(e: EmployeeRecord): MyLaboral {
  return {
    displayId: e.displayId,
    codNom: e.codNom,
    status: e.status,
    position: e.position,
    level: e.level,
    project: e.project,
    companyName: e.companyName,
    companyCode: e.companyCode,
    division: e.division,
    area: e.area,
    directReportTo: e.directReportTo,
    location: e.location,
    modality: e.modality,
    contractSchema: e.contractSchema,
    corporateEmail: e.corporateEmail,
    emailSignature: e.emailSignature,
    seniorityDate: e.seniorityDate,
    contractType: e.contractType,
    contractEndDate: e.contractEndDate,
    schedule: e.schedule,
    lunchTime: e.lunchTime,
    gender: e.gender,
    nationality: e.nationality,
    studies: e.studies,
  };
}

export function toMyPersonal(p: PersonalData | null): MyPersonal | null {
  if (!p) return null;
  return {
    rfc: p.rfc,
    curp: p.curp,
    imssNumber: p.imssNumber,
    bloodType: p.bloodType,
    birthDate: p.birthDate,
    maritalStatus: p.maritalStatus,
    children: p.children,
    phone: p.phone,
    mainTransport: p.mainTransport,
    commuteTime: p.commuteTime,
    street: p.street,
    extNumber: p.extNumber,
    intNumber: p.intNumber,
    neighborhood: p.neighborhood,
    postalCode: p.postalCode,
    city: p.city,
    state: p.state,
  };
}

export function toMyProfile(e: EmployeeRecord, p: PersonalData | null): MyProfile {
  return { fullName: e.fullName, laboral: toMyLaboral(e), personal: toMyPersonal(p) };
}

export interface MyDocument {
  id: string;
  type: string;
  name: string;
  uploadedAt: string;
}

/** Documento visible al colaborador (sin llave de S3 ni quién lo subió). */
export function toMyDocument(d: { id: string; type: string; name: string; uploadedAt: Date | string }): MyDocument {
  return { id: d.id, type: d.type, name: d.name, uploadedAt: new Date(d.uploadedAt).toISOString() };
}
