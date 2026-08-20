import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import JSZip from 'jszip';
import { Repository } from 'typeorm';
import {
  ANCLA_PARRAFO_PODER,
  CONTRACT_LABELS,
  CONTRACT_TEMPLATE_KEYS,
  valoresGuiones,
  valoresParaContrato,
  type ContractType,
} from './contract-mappings';
import {
  contarMarcadores,
  eliminarParrafosCon,
  rellenarGuiones,
  rellenarMarcadores,
} from './contract-template.util';
import { GenerateContractDto } from './dto/contract.dto';
import { ClientRecord } from './entities/client-record.entity';
import { Company } from './entities/company.entity';

export interface GeneratedContract {
  buffer: Buffer;
  fileName: string;
  /** Diagnóstico: permite detectar plantillas que cambiaron sin avisar. */
  marcadoresRellenados: number;
  marcadoresTotales: number;
  parrafosEliminados: number;
}

/** Datos del cliente que se ofrecen pre-llenados al abrir el modal. */
export interface ContractPrefill {
  razonSocial: string | null;
  nombreComercial: string | null;
  rfc: string | null;
  ciudad: string | null;
  domicilio: string | null;
}

@Injectable()
export class ClientContractsService {
  private readonly logger = new Logger(ClientContractsService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(ClientRecord)
    private readonly clientsRepository: Repository<ClientRecord>,
    @InjectRepository(Company)
    private readonly companiesRepository: Repository<Company>,
  ) {
    this.bucket = this.configService.getOrThrow<string>('S3_BUCKET');
    this.s3 = new S3Client({
      region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
    });
  }

  /** Datos del cliente para pre-llenar el formulario del contrato. */
  async getPrefill(clientId: string): Promise<ContractPrefill> {
    const client = await this.clientsRepository.findOne({ where: { id: clientId } });
    if (!client) throw new NotFoundException(`Cliente ${clientId} no encontrado`);

    const company = client.primaryCompanyId
      ? await this.companiesRepository.findOne({ where: { id: client.primaryCompanyId } })
      : null;

    return {
      razonSocial: company?.legalName ?? company?.name ?? null,
      nombreComercial: company?.name ?? null,
      rfc: company?.rfc ?? null,
      ciudad: client.city ?? null,
      domicilio: client.address ?? null,
    };
  }

  async generateContract(
    clientId: string,
    dto: GenerateContractDto,
  ): Promise<GeneratedContract> {
    const client = await this.clientsRepository.findOne({ where: { id: clientId } });
    if (!client) throw new NotFoundException(`Cliente ${clientId} no encontrado`);

    const tipo = dto.contractType;
    const templateKey = CONTRACT_TEMPLATE_KEYS[tipo];
    if (!templateKey) throw new BadRequestException(`Tipo de contrato no válido: ${tipo}`);

    const zip = await JSZip.loadAsync(await this.descargarPlantilla(templateKey));
    const documento = zip.file('word/document.xml');
    if (!documento) {
      throw new BadRequestException('La plantilla no es un .docx válido (falta word/document.xml)');
    }

    let xml = await documento.async('string');
    let parrafosEliminados = 0;

    // El párrafo del poder se quita ANTES de rellenar: al eliminarlo desaparecen
    // sus marcadores y la numeración posterior se recorre.
    if (tipo === 'fin-re-02-moral' && dto.poderEnEscrituraConstitutiva === true) {
      const res = eliminarParrafosCon(xml, ANCLA_PARRAFO_PODER);
      xml = res.xml;
      parrafosEliminados = res.eliminados;
      if (parrafosEliminados === 0) {
        this.logger.warn(
          'Se pidió omitir el párrafo del poder pero no se encontró el ancla en la plantilla; ' +
            'el contrato saldrá con el párrafo. Revisar si la plantilla cambió.',
        );
      }
    }

    const esperados = contarMarcadores(xml);
    const valores = valoresParaContrato(tipo, dto);

    // Si el conteo no cuadra, el mapeo posicional estaría desalineado y los datos
    // caerían en huecos equivocados. Es un contrato: mejor fallar que emitirlo mal.
    if (valores.length !== esperados) {
      throw new BadRequestException(
        `La plantilla ${CONTRACT_LABELS[tipo]} tiene ${esperados} huecos y el mapeo aporta ` +
          `${valores.length}. No se genera el contrato para no colocar datos en huecos equivocados.`,
      );
    }

    const conMarcadores = rellenarMarcadores(xml, valores);
    const conGuiones = rellenarGuiones(conMarcadores.xml, valoresGuiones(tipo, dto));

    zip.file('word/document.xml', conGuiones.xml);
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    return {
      buffer,
      fileName: this.nombreArchivo(tipo, dto, client),
      marcadoresRellenados: conMarcadores.rellenados,
      marcadoresTotales: conMarcadores.totalMarcadores,
      parrafosEliminados,
    };
  }

  private async descargarPlantilla(key: string): Promise<Buffer> {
    const respuesta = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = await respuesta.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  /** `COM-RE-02-Aeropuerto-de-Leon-2026-08-20.docx` */
  private nombreArchivo(
    tipo: ContractType,
    dto: GenerateContractDto,
    client: ClientRecord,
  ): string {
    const base =
      dto.razonSocial ?? dto.nombreCliente ?? client.displayId ?? 'cliente';
    const slug = base
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60);

    return `${CONTRACT_LABELS[tipo]}-${slug}-${dto.fechaContrato}.docx`;
  }
}
