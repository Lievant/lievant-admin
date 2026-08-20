import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { ContractType } from '../contract-mappings';

const TIPOS: ContractType[] = ['com-re-02', 'com-re-04', 'fin-re-02-moral', 'fin-re-03-fisica'];

export class ContractServiceLineDto {
  @IsString()
  @MaxLength(300)
  nombre!: string;

  @IsOptional()
  @IsString()
  fechaInicio?: string;

  /** Monto en número, ya formateado por el frontend (p. ej. "45,000.00"). */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  monto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  montoLetras?: string;
}

export class GenerateContractDto {
  @IsIn(TIPOS)
  contractType!: ContractType;

  // ── Identidad del cliente ────────────────────────────────────────────────
  @IsOptional() @IsString() @MaxLength(300) razonSocial?: string;
  @IsOptional() @IsString() @MaxLength(300) nombreCliente?: string;
  @IsOptional() @IsString() @MaxLength(300) representanteLegal?: string;
  @IsOptional() @IsString() @MaxLength(20) rfc?: string;

  // ── Domicilio ────────────────────────────────────────────────────────────
  @IsOptional() @IsString() @MaxLength(300) domicilio?: string;
  @IsOptional() @IsString() @MaxLength(200) calle?: string;
  @IsOptional() @IsString() @MaxLength(40) numeroExterior?: string;
  @IsOptional() @IsString() @MaxLength(150) colonia?: string;
  @IsOptional() @IsString() @MaxLength(10) codigoPostal?: string;
  @IsOptional() @IsString() @MaxLength(150) ciudad?: string;

  // ── Fechas ───────────────────────────────────────────────────────────────
  /** ISO yyyy-mm-dd. Obligatoria: alimenta la fecha de comparecencia. */
  @IsString() @IsNotEmpty() fechaContrato!: string;
  @IsOptional() @IsString() fechaInicio?: string;
  @IsOptional() @IsString() fechaFin?: string;
  @IsOptional() @IsString() fechaFirma?: string;

  // ── Escritura constitutiva (solo persona moral) ──────────────────────────
  @IsOptional() @IsString() @MaxLength(60) escrituraNumero?: string;
  @IsOptional() @IsString() @MaxLength(60) escrituraFecha?: string;
  @IsOptional() @IsString() @MaxLength(60) notarioNumero?: string;
  @IsOptional() @IsString() @MaxLength(200) notarioNombre?: string;
  @IsOptional() @IsString() @MaxLength(150) ciudadNotario?: string;
  @IsOptional() @IsString() @MaxLength(60) folioMercantil?: string;
  @IsOptional() @IsString() @MaxLength(150) ciudadRegistro?: string;
  @IsOptional() @IsString() @MaxLength(150) estadoRegistro?: string;

  /**
   * Cuando es true se omite el párrafo del poder del representante: la propia
   * plantilla FIN-RE-02 indica que se suprime si el poder consta en la misma
   * escritura constitutiva.
   */
  @IsOptional() @IsBoolean() poderEnEscrituraConstitutiva?: boolean;

  // ── Poder del representante (solo si no consta en la constitutiva) ────────
  @IsOptional() @IsString() @MaxLength(60) poderEscrituraNumero?: string;
  @IsOptional() @IsString() @MaxLength(60) poderEscrituraFecha?: string;
  @IsOptional() @IsString() @MaxLength(60) poderNotarioNumero?: string;
  @IsOptional() @IsString() @MaxLength(200) poderNotarioNombre?: string;
  @IsOptional() @IsString() @MaxLength(150) poderCiudadNotario?: string;

  // ── Servicios y montos ───────────────────────────────────────────────────
  @IsOptional() @IsString() @MaxLength(300) servicioObjeto?: string;
  @IsOptional() @IsString() @MaxLength(150) canal1?: string;
  @IsOptional() @IsString() @MaxLength(150) canal2?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) duracionMeses?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) mesesServicio?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) numeroPagos?: number;

  @IsOptional() @IsString() @MaxLength(60) montoTotal?: string;
  @IsOptional() @IsString() @MaxLength(300) montoTotalLetras?: string;
  @IsOptional() @IsString() @MaxLength(60) pagoMensual?: string;
  @IsOptional() @IsString() @MaxLength(300) pagoMensualLetras?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractServiceLineDto)
  servicios?: ContractServiceLineDto[];
}
