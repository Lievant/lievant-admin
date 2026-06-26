/**
 * Seed: Head count de empleados desde Excel
 *
 * Lee el archivo uploads/Preuba 1.xlsx (hoja "Junio") y crea:
 *   - EmployeeRecord  (datos laborales)
 *   - PersonalData    (RFC, CURP, IMSS, nacimiento, domicilio)
 *   - Compensation    (salarios y beneficios)
 *
 * Idempotente: omite filas cuyo corporateEmail ya existe en la BD.
 *
 * Ejecutar:
 *   npm run seed:employees       (desde apps/api/)
 *
 * Prerequisito: colocar el archivo en
 *   <repo-root>/uploads/Preuba 1.xlsx
 */

import * as path from 'path';
import * as XLSX from 'xlsx';
import AppDataSource from '../data-source';
import { EmployeeRecord } from '../../modules/employees/entities/employee-record.entity';
import { PersonalData } from '../../modules/employees/entities/personal-data.entity';
import { Compensation } from '../../modules/employees/entities/compensation.entity';
import { EmployeeStatus } from '../../modules/employees/constants/employee-status.constant';
import { Modality } from '../../modules/employees/constants/modality.constant';

// ── Ruta al archivo ─────────────────────────────────────────────────────────
// Desde apps/api/src/database/seeds/ subir 4 niveles llega a la raíz del repo
// process.cwd() = apps/api cuando se lanza con `npm run seed:employees`
const EXCEL_PATH = path.resolve(process.cwd(), '../../uploads/Preuba_1.xlsx');

// ── Layout del Excel ─────────────────────────────────────────────────────────
const DATA_START_ROW = 13; // 0-indexed; fila 12 = encabezados, 13+ = datos

// Índices de columna (0-based, hoja "Junio")
const C = {
  COD_NOM:           0,  // A
  COMPANY_CODE:      1,  // B  CODIGO EMPRESA
  COMPANY_NAME:      2,  // C  EMPRESA
  DIVISION:          3,  // D
  AREA:              4,  // E
  PROJECT:           5,  // F
  LEVEL:             6,  // G  NIVEL
  POSITION:          7,  // H  PUESTO (jerarquía)
  EMAIL_SIGNATURE:   8,  // I  FIRMA DE CORREO ELECTRONICO
  LOCATION:          9,  // J  UBICACIÓN
  MODALITY:         10,  // K  MODALIDAD
  CONTRACT_SCHEMA:  11,  // L  CONTRATO
  DISPLAY_ID:       12,  // M  ID EMPLEADO
  FULL_NAME:        13,  // N  NOMBRE COMPLETO
  DIRECT_REPORT_TO: 14,  // O  DEPENDENCIA DIRECTA
  CORPORATE_EMAIL:  15,  // P  C ELECTRONICO
  RFC:              16,  // Q
  // R(17) = longitud RFC  → ignorar
  IMSS:             18,  // S  N IMSS
  // T(19) = longitud IMSS → ignorar
  CURP:             20,  // U
  // V(21) = longitud CURP → ignorar
  GENDER:           22,  // W  GENERO (H/M)
  BIRTH_DATE:       23,  // X  F NACIMIENTO (serial Excel)
  // Y(24) = EDAD calculada → ignorar
  NATIONALITY:      25,  // Z
  SENIORITY_DATE:   26,  // AA F ANTIGÜEDAD (serial Excel o texto)
  // AB(27) = ANTIGÜEDAD calculada → ignorar
  CONTRACT_TYPE:    28,  // AC TIPO DE CONTRATO
  CONTRACT_END:     29,  // AD TERMINO DE CONTRATO
  DAILY_GROSS:      30,  // AE SUELDO BRUTO D
  MONTHLY_GROSS:    31,  // AF SUELDO BRUTO M
  SERVICE_PAYMENT:  32,  // AG PAGO DE SERVICIOS
  LAST_SAL_CHANGE:  33,  // AH ULTIMA MODIFICACIÓN
  REMOTE_WORK:      34,  // AI TELE TRABAJO
  GROCERY_VOUCHERS: 35,  // AJ VALES DE DESPENSA
  GAS_VOUCHERS:     36,  // AK VALES DE GASOLINA
  HEALTH_INSURANCE: 37,  // AL GMM
  PHONE_ALLOWANCE:  38,  // AM SALDO TELEFONICO
  PUNCT_BONUS:      39,  // AN BONO PUNTUALIDAD
  OTHER_BENEFITS:   40,  // AO OTROS
  TOTAL_GROSS:      41,  // AP PAGO TOTAL BRUTO
  NET_ESTIMATE:     42,  // AQ CALCULO DEL NETO
  SCHEDULE:         50,  // AY HORARIO
  LUNCH_TIME:       51,  // AZ T. COMIDA
  STUDIES:          52,  // BA ESTUDIOS
  STREET:           53,  // BB CALLE
  EXT_NUMBER:       54,  // BC NÚMERO EXT.
  INT_NUMBER:       55,  // BD NÚM. INTERIOR
  NEIGHBORHOOD:     56,  // BE COLONIA
  POSTAL_CODE:      57,  // BF CÓDIGO POSTAL
  CITY:             58,  // BG MUNICIPIO/DELEGACIÓN
  STATE:            59,  // BH ESTADO
  PHONE:            60,  // BI TELEFONO
  // BJ(61) = extensión/longitud → ignorar
  MAIN_TRANSPORT:   62,  // BK TRANSPORTE PRINCIPAL
  COMMUTE_TIME:     63,  // BL TIEMPO DE TRASLADO
  BLOOD_TYPE:       64,  // BM TIPO DE SANGRE
  MARITAL_STATUS:   65,  // BN ESTADO CIVIL
  CHILDREN:         66,  // BO HIJOS
} as const;

// ── Mapeos ───────────────────────────────────────────────────────────────────

const COMPANY_NAME_MAP: Record<string, string> = {
  'LIEVANT':            'Lievant',
  'LIEVANT CO':         'Lievant CO',
  'ACCIONES DIGITALES': 'Databeans',
  'ECOMMERCE GO':       'Triciclo',
};

const MODALITY_MAP: Record<string, Modality> = {
  'PRESENCIAL':  Modality.PRESENCIAL,
  'REMOTO':      Modality.REMOTO,
  'REMOTA':      Modality.REMOTO,
  'HOME OFFICE': Modality.REMOTO,
  'HIBRIDO':     Modality.HIBRIDO,
  'HIBRIDA':     Modality.HIBRIDO,
};

const GENDER_MAP: Record<string, string> = {
  'H': 'Masculino',
  'M': 'Femenino',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function cellStr(ws: XLSX.WorkSheet, r: number, col: number): string | null {
  const cell = ws[XLSX.utils.encode_cell({ r, c: col })];
  if (!cell || cell.v === null || cell.v === undefined) return null;
  // Take first line only — some cells have duplicate values separated by newlines
  const val = String(cell.v).split(/\r?\n/)[0]!.trim();
  if (val === '' || val === '#N/A' || val.startsWith('#')) return null;
  return val;
}

function cellNum(ws: XLSX.WorkSheet, r: number, col: number): number | null {
  const cell = ws[XLSX.utils.encode_cell({ r, c: col })];
  if (!cell || cell.t !== 'n') return null;
  const n = Number(cell.v);
  return isNaN(n) ? null : n;
}

/** Convierte serial de fecha Excel a 'YYYY-MM-DD' */
function excelSerialToDateStr(serial: number): string {
  // El epoch de Excel es 1900-01-01; JavaScript usa 1970-01-01.
  // 25569 = días entre los dos epochs (corregido por el bug del año bisiesto de Excel).
  const ms = (serial - 25569) * 86400 * 1000;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dy = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dy}`;
}

/** Lee una celda y devuelve 'YYYY-MM-DD' o null */
function toDateStr(ws: XLSX.WorkSheet, r: number, col: number): string | null {
  const cell = ws[XLSX.utils.encode_cell({ r, c: col })];
  if (!cell) return null;

  if (cell.t === 'n' && cell.v > 0) {
    return excelSerialToDateStr(cell.v as number);
  }

  if (cell.t === 's') {
    const s = String(cell.v).trim();
    if (!s || s === '#N/A') return null;
    // DD/MM/YYYY
    const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m1) return `${m1[3]!}-${m1[2]!.padStart(2, '0')}-${m1[1]!.padStart(2, '0')}`;
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // No reconocido como fecha — ignorar
    return null;
  }

  return null;
}

/**
 * Lee una celda numérica como string decimal con 2 decimales.
 * Devuelve null si el valor es 0, CONFIDENCIAL, o inválido.
 */
function toDecimalStr(ws: XLSX.WorkSheet, r: number, col: number): string | null {
  const cell = ws[XLSX.utils.encode_cell({ r, c: col })];
  if (!cell) return null;
  if (cell.t === 'n') {
    const n = Number(cell.v);
    if (isNaN(n) || n <= 0) return null;
    return n.toFixed(2);
  }
  if (cell.t === 's') {
    const s = String(cell.v).trim().toUpperCase();
    // Intentar parsear como número (ej. "42,500.00")
    const clean = s.replace(/[$,\s]/g, '');
    if (clean && clean !== 'CONFIDENCIAL' && clean !== '-') {
      const n = parseFloat(clean);
      if (!isNaN(n) && n > 0) return n.toFixed(2);
    }
  }
  return null;
}

function normalizeCompanyName(raw: string): string {
  const key = raw.trim().toUpperCase();
  return COMPANY_NAME_MAP[key] ?? raw.trim();
}

/** Trunca a maxLen caracteres para respetar restricciones de columna */
function trunc(val: string | null | undefined, maxLen: number): string | null {
  if (!val) return null;
  return val.length > maxLen ? val.substring(0, maxLen) : val;
}

/**
 * Valida si el valor del Excel es un displayId útil.
 * Rechaza valores muy cortos (1-2 letras sueltas), frases largas,
 * o texto con espacios internos.
 */
function parseDisplayId(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (s.length < 2 || s.length > 15) return null;
  if (/\s/.test(s)) return null; // contiene espacio → es una frase
  return s;
}

// ── Seed principal ───────────────────────────────────────────────────────────

async function run(): Promise<void> {
  // Verificar que el archivo existe antes de conectar a la BD
  const fs = await import('fs');
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`\n❌  Archivo no encontrado: ${EXCEL_PATH}`);
    console.error('   Coloca el archivo Excel en la carpeta uploads/ del repo antes de ejecutar este seed.\n');
    process.exit(1);
  }

  await AppDataSource.initialize();

  const employeesRepo   = AppDataSource.getRepository(EmployeeRecord);
  const personalRepo    = AppDataSource.getRepository(PersonalData);
  const compensationRepo = AppDataSource.getRepository(Compensation);

  // Cargar Excel
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]!]!; // hoja "Junio"
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:A1');

  // Determinar el siguiente número libre para EMP-XXXX
  const lastEmp = await employeesRepo
    .createQueryBuilder('e')
    .where("e.displayId LIKE 'EMP-%'")
    .orderBy('e.displayId', 'DESC')
    .getOne();
  let empCounter = 1;
  if (lastEmp) {
    const n = parseInt(lastEmp.displayId.replace('EMP-', ''), 10);
    if (!isNaN(n)) empCounter = n + 1;
  }

  let created = 0;
  let skipped = 0;
  let invalid = 0;

  console.log(`\nProcesando ${EXCEL_PATH}...\n`);

  for (let r = DATA_START_ROW; r <= range.e.r; r++) {
    const fullName = cellStr(ws, r, C.FULL_NAME);
    const email    = cellStr(ws, r, C.CORPORATE_EMAIL);

    // Saltar filas sin nombre o sin email válido
    if (!fullName || !email || !email.includes('@')) {
      invalid++;
      continue;
    }

    // Idempotencia: verificar por email
    // Si ya existe, completar sub-registros faltantes (personal_data / compensation)
    const existing = await employeesRepo.findOne({ where: { corporateEmail: email } });

    let savedId: string;
    let companyName: string;

    if (existing) {
      savedId     = existing.id;
      companyName = existing.companyName;
      skipped++;
    } else {
      // ── DisplayId ──
      let displayId = parseDisplayId(cellStr(ws, r, C.DISPLAY_ID));
      if (displayId) {
        const clash = await employeesRepo.findOne({ where: { displayId } });
        if (clash) displayId = null;
      }
      if (!displayId) {
        displayId = `EMP-${String(empCounter).padStart(4, '0')}`;
        empCounter++;
      }

      // ── Empresa ──
      const rawCompanyName = cellStr(ws, r, C.COMPANY_NAME) ?? '';
      companyName          = normalizeCompanyName(rawCompanyName);
      const companyCode    = cellStr(ws, r, C.COMPANY_CODE) ?? companyName.substring(0, 5).toUpperCase();

      // ── Modalidad ──
      const rawModality = cellStr(ws, r, C.MODALITY);
      const modality    = rawModality ? (MODALITY_MAP[rawModality.toUpperCase()] ?? null) : null;

      // ── Género ──
      const rawGender = cellStr(ws, r, C.GENDER);
      const gender    = rawGender ? (GENDER_MAP[rawGender.toUpperCase()] ?? rawGender) : null;

      // ── Proyecto ──
      const project = cellStr(ws, r, C.PROJECT);

      const record = employeesRepo.create({
        displayId,
        codNom:          cellStr(ws, r, C.COD_NOM),
        companyCode,
        companyName,
        division:        cellStr(ws, r, C.DIVISION),
        area:            cellStr(ws, r, C.AREA),
        project:         project === 'NA' ? null : project,
        level:           cellStr(ws, r, C.LEVEL),
        position:        cellStr(ws, r, C.POSITION) ?? 'Sin definir',
        emailSignature:  cellStr(ws, r, C.EMAIL_SIGNATURE),
        location:        cellStr(ws, r, C.LOCATION),
        modality,
        contractSchema:  cellStr(ws, r, C.CONTRACT_SCHEMA),
        fullName,
        directReportTo:  cellStr(ws, r, C.DIRECT_REPORT_TO),
        corporateEmail:  email,
        gender,
        nationality:     cellStr(ws, r, C.NATIONALITY),
        seniorityDate:   toDateStr(ws, r, C.SENIORITY_DATE),
        contractType:    cellStr(ws, r, C.CONTRACT_TYPE),
        contractEndDate: toDateStr(ws, r, C.CONTRACT_END),
        schedule:        cellStr(ws, r, C.SCHEDULE),
        lunchTime:       cellStr(ws, r, C.LUNCH_TIME),
        studies:         cellStr(ws, r, C.STUDIES),
        status:          EmployeeStatus.ACTIVE,
        authUserId:      null,
      });

      const saved = await employeesRepo.save(record);
      savedId = saved.id;
      created++;
      console.log(`  ✓  ${companyName} | ${fullName} <${email}>`);
    }

    // ── PersonalData (crear si no existe) ──
    const hasPersonalData = await personalRepo.findOne({ where: { employeeId: savedId } });
    if (!hasPersonalData) {
      const rfc       = cellStr(ws, r, C.RFC);
      const curp      = cellStr(ws, r, C.CURP);
      const birthDate = toDateStr(ws, r, C.BIRTH_DATE);
      const imssRaw   = cellNum(ws, r, C.IMSS);
      const imss      = imssRaw && imssRaw > 0 ? String(imssRaw) : null;
      const street    = cellStr(ws, r, C.STREET);
      const city      = cellStr(ws, r, C.CITY);

      if (rfc || curp || imss || birthDate || street || city) {
        const postalRaw = cellNum(ws, r, C.POSTAL_CODE);
        const phoneRaw  = cellNum(ws, r, C.PHONE);

        await personalRepo.save(
          personalRepo.create({
            employeeId:    savedId,
            rfc:           trunc(rfc, 13),
            curp:          trunc(curp, 18),
            imssNumber:    trunc(imss, 20),
            birthDate,
            phone:         trunc(phoneRaw ? String(phoneRaw) : null, 20),
            street:        cellStr(ws, r, C.STREET),
            extNumber:     trunc(cellStr(ws, r, C.EXT_NUMBER) === 'NA' ? null : cellStr(ws, r, C.EXT_NUMBER), 20),
            intNumber:     trunc(cellStr(ws, r, C.INT_NUMBER) === 'NA' ? null : cellStr(ws, r, C.INT_NUMBER), 20),
            neighborhood:  cellStr(ws, r, C.NEIGHBORHOOD),
            postalCode:    trunc(postalRaw ? String(postalRaw) : null, 10),
            city,
            state:         cellStr(ws, r, C.STATE),
            mainTransport: cellStr(ws, r, C.MAIN_TRANSPORT),
            commuteTime:   trunc(cellStr(ws, r, C.COMMUTE_TIME), 50),
            bloodType:     trunc(cellStr(ws, r, C.BLOOD_TYPE), 5),
            maritalStatus: trunc(cellStr(ws, r, C.MARITAL_STATUS), 30),
            children:      cellNum(ws, r, C.CHILDREN) ?? 0,
          }),
        );
        if (existing) console.log(`  +  PersonalData completado: ${fullName}`);
      }
    }

    // ── Compensation (crear si no existe) ──
    const hasCompensation = await compensationRepo.findOne({ where: { employeeId: savedId } });
    if (!hasCompensation) {
      const dailyGross   = toDecimalStr(ws, r, C.DAILY_GROSS);
      const monthlyGross = toDecimalStr(ws, r, C.MONTHLY_GROSS);
      const svcPayment   = toDecimalStr(ws, r, C.SERVICE_PAYMENT);
      const totalGross   = toDecimalStr(ws, r, C.TOTAL_GROSS);

      const gmmCell = ws[XLSX.utils.encode_cell({ r, c: C.HEALTH_INSURANCE })];
      const healthInsurance = gmmCell && gmmCell.v && String(gmmCell.v).toUpperCase() !== 'CONFIDENCIAL'
        ? trunc(String(gmmCell.v).trim() || null, 50)
        : null;

      if (dailyGross || monthlyGross || svcPayment || totalGross) {
        await compensationRepo.save(
          compensationRepo.create({
            employeeId:          savedId,
            dailyGrossSalary:    dailyGross,
            monthlyGrossSalary:  monthlyGross,
            servicePayment:      svcPayment,
            lastSalaryChange:    toDateStr(ws, r, C.LAST_SAL_CHANGE),
            remoteWorkAllowance: toDecimalStr(ws, r, C.REMOTE_WORK),
            groceryVouchers:     toDecimalStr(ws, r, C.GROCERY_VOUCHERS),
            gasVouchers:         toDecimalStr(ws, r, C.GAS_VOUCHERS),
            healthInsurance,
            phoneAllowance:      toDecimalStr(ws, r, C.PHONE_ALLOWANCE),
            punctualityBonus:    toDecimalStr(ws, r, C.PUNCT_BONUS),
            otherBenefits:       cellStr(ws, r, C.OTHER_BENEFITS),
            totalGross,
            netEstimate:         toDecimalStr(ws, r, C.NET_ESTIMATE),
          }),
        );
        if (existing) console.log(`  +  Compensation completado: ${fullName}`);
      }
    }
  }

  console.log(`\n─────────────────────────────────────────────`);
  console.log(`  Creados  : ${created}`);
  console.log(`  Omitidos : ${skipped} (ya existían)`);
  console.log(`  Inválidos: ${invalid} (sin nombre o email)`);
  console.log(`─────────────────────────────────────────────\n`);

  await AppDataSource.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
