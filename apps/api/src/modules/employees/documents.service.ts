import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeRecord } from './entities/employee-record.entity';
import { PersonalData } from './entities/personal-data.entity';
import { Compensation } from './entities/compensation.entity';
import createReport from 'docx-templates';
import { Readable } from 'stream';

export type DocumentType =
  | 'contrato_determinado'
  | 'contrato_indeterminado'
  | 'convenio_practicas'
  | 'confidencialidad'
  | 'no_competencia';

const TEMPLATE_KEYS: Record<DocumentType, string> = {
  contrato_determinado: 'templates/hr/contrato_determinado.docx',
  contrato_indeterminado: 'templates/hr/contrato_indeterminado.docx',
  convenio_practicas: 'templates/hr/convenio_practicas.docx',
  confidencialidad: 'templates/hr/confidencialidad.docx',
  no_competencia: 'templates/hr/no_competencia.docx',
};

const MESES = [
  'ENERO',
  'FEBRERO',
  'MARZO',
  'ABRIL',
  'MAYO',
  'JUNIO',
  'JULIO',
  'AGOSTO',
  'SEPTIEMBRE',
  'OCTUBRE',
  'NOVIEMBRE',
  'DICIEMBRE',
];

const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const DIEZ_A_DIECINUEVE = [
  'DIEZ',
  'ONCE',
  'DOCE',
  'TRECE',
  'CATORCE',
  'QUINCE',
  'DIECISÉIS',
  'DIECISIETE',
  'DIECIOCHO',
  'DIECINUEVE',
];
const VEINTE_A_VEINTINUEVE = [
  'VEINTE',
  'VEINTIUNO',
  'VEINTIDÓS',
  'VEINTITRÉS',
  'VEINTICUATRO',
  'VEINTICINCO',
  'VEINTISÉIS',
  'VEINTISIETE',
  'VEINTIOCHO',
  'VEINTINUEVE',
];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = [
  '',
  'CIENTO',
  'DOSCIENTOS',
  'TRESCIENTOS',
  'CUATROCIENTOS',
  'QUINIENTOS',
  'SEISCIENTOS',
  'SETECIENTOS',
  'OCHOCIENTOS',
  'NOVECIENTOS',
];

function convertTens(n: number): string {
  if (n < 10) return UNIDADES[n] ?? '';
  if (n < 20) return DIEZ_A_DIECINUEVE[n - 10] ?? '';
  if (n < 30) return VEINTE_A_VEINTINUEVE[n - 20] ?? '';
  const tens = Math.floor(n / 10);
  const units = n % 10;
  return units === 0 ? DECENAS[tens] ?? '' : `${DECENAS[tens] ?? ''} Y ${UNIDADES[units] ?? ''}`;
}

function convertHundreds(n: number): string {
  if (n === 100) return 'CIEN';
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const hundredsWord = CENTENAS[hundreds] ?? '';
  if (rest === 0) return hundredsWord;
  return hundredsWord ? `${hundredsWord} ${convertTens(rest)}` : convertTens(rest);
}

function numberToWords(num: number): string {
  if (num === 0) return 'CERO';

  const millions = Math.floor(num / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const rest = num % 1000;

  const parts: string[] = [];

  if (millions > 0) {
    parts.push(millions === 1 ? 'UN MILLÓN' : `${convertHundreds(millions)} MILLONES`);
  }

  if (thousands > 0) {
    parts.push(thousands === 1 ? 'MIL' : `${convertHundreds(thousands)} MIL`);
  }

  if (rest > 0) {
    parts.push(convertHundreds(rest));
  }

  return parts.join(' ').trim();
}

function amountToWords(amount: number): string {
  const pesos = Math.floor(amount);
  const centavos = Math.round((amount - pesos) * 100);
  return `${numberToWords(pesos)} PESOS ${String(centavos).padStart(2, '0')}/100 M.N.`;
}

@Injectable()
export class DocumentsService {
  private s3: S3Client;
  private bucket: string;

  constructor(
    private configService: ConfigService,
    @InjectRepository(EmployeeRecord)
    private employeeRepo: Repository<EmployeeRecord>,
    @InjectRepository(PersonalData)
    private personalDataRepo: Repository<PersonalData>,
    @InjectRepository(Compensation)
    private compensationRepo: Repository<Compensation>,
  ) {
    this.s3 = new S3Client({ region: 'us-east-1' });
    this.bucket = this.configService.getOrThrow<string>('S3_BUCKET');
  }

  async generateDocument(
    employeeId: string,
    docType: DocumentType,
    extraData?: Record<string, string>,
  ): Promise<Buffer> {
    // 1. Cargar datos del empleado
    const employee = await this.employeeRepo.findOneOrFail({ where: { id: employeeId } });
    const personal = await this.personalDataRepo.findOne({ where: { employeeId } });
    const compensation = await this.compensationRepo.findOne({ where: { employeeId } });

    // 2. Calcular edad
    const age = personal?.birthDate
      ? String(new Date().getFullYear() - new Date(personal.birthDate).getFullYear())
      : '';

    // 3. Formatear salario (numérico y en letras)
    const monthlyAmount = compensation?.monthlyGrossSalary ? parseFloat(compensation.monthlyGrossSalary) : null;
    const biweeklyAmount = monthlyAmount !== null ? monthlyAmount / 2 : null;

    const monthlySalary = monthlyAmount !== null
      ? monthlyAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })
      : '';
    const biweeklySalary = biweeklyAmount !== null
      ? biweeklyAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })
      : '';
    const salaryWords = monthlyAmount !== null ? amountToWords(monthlyAmount) : '';
    const biweeklySalaryWords = biweeklyAmount !== null ? amountToWords(biweeklyAmount) : '';

    // 4. Descomponer fecha de inicio
    const startDate = employee.seniorityDate ? new Date(employee.seniorityDate) : null;
    const startDay = startDate ? String(startDate.getDate()) : '';
    const startMonth = startDate ? MESES[startDate.getMonth()] ?? '' : '';

    // 5. Variables de reemplazo (deben coincidir exactamente con los marcadores {{}} de las plantillas)
    const variables: Record<string, string> = {
      NOMBRE_COMPLETO: employee.fullName ?? '',
      EDAD: age,
      SEXO: employee.gender ?? '',
      NACIONALIDAD: employee.nationality ?? 'MEXICANA',
      PAIS: 'México',
      CURP: personal?.curp ?? '',
      RFC: personal?.rfc ?? '',
      N_IMSS: personal?.imssNumber ?? '',
      CALLE: personal?.street ?? '',
      NUMERO_EXT: personal?.extNumber ?? '',
      COLONIA: personal?.neighborhood ?? '',
      CP: personal?.postalCode ?? '',
      CIUDAD: personal?.city ?? '',
      ESTADO: personal?.state ?? '',
      PUESTO: employee.position ?? '',
      SALARIO_MENSUAL: monthlySalary,
      SALARIO_QUINCENAL: biweeklySalary,
      SALARIO_LETRA: salaryWords,
      SALARIO_QUINCENAL_LETRA: biweeklySalaryWords,
      FECHA_INICIO: employee.seniorityDate ?? '',
      FECHA_FIN: employee.contractEndDate ?? '',
      DIA_INICIO: startDay,
      MES_INICIO: startMonth,
      // Campos extra (convenio de prácticas)
      CARRERA: extraData?.CARRERA ?? '',
      MATRICULA: extraData?.MATRICULA ?? '',
      DURACION_MESES: extraData?.DURACION_MESES ?? '',
      ...extraData,
    };

    // 6. Descargar plantilla de S3
    const templateKey = TEMPLATE_KEYS[docType];
    const s3Response = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: templateKey,
      }),
    );

    const templateBuffer = Buffer.from(
      await new Promise<Uint8Array>((resolve, reject) => {
        const chunks: Uint8Array[] = [];
        const stream = s3Response.Body as Readable;
        stream.on('data', (chunk: Uint8Array) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      }),
    );

    // 7. Generar documento con docx-templates
    const result = await createReport({
      template: templateBuffer,
      data: variables,
      cmdDelimiter: ['{{', '}}'],
      processLineBreaks: true,
    });

    return Buffer.from(result);
  }
}
