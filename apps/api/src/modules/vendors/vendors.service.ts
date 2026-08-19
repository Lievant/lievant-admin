import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { QueryPurchaseOrdersDto } from './dto/query-purchase-orders.dto';
import { QueryVendorsDto } from './dto/query-vendors.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import {
  PresignedUploadDto,
  RegisterVendorDocumentDto,
  UploadVendorDocumentDto,
} from './dto/upload-vendor-document.dto';
import {
  assertKeyInPrefix,
  assertUploadAllowed,
  MAX_UPLOAD_BYTES,
} from '../../common/s3-upload.util';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { Vendor, VendorStatus } from './entities/vendor.entity';
import { VendorDocument } from './entities/vendor-document.entity';
import { VendorProduct } from './entities/vendor-product.entity';
import { ALLOWED_DOCUMENT_MIME_TYPES, VendorStorageService } from './vendor-storage.service';
// Se reutiliza el cursor de clientes: mismo formato base64url { createdAt, id }
// para que ambas pantallas paginen igual y no existan dos codificaciones.
import { decodeCursor, encodeCursor } from '../clients/utils/cursor.util';

export type InvoiceWithUrl = Invoice & { pdfUrl?: string };

export interface VendorStatement {
  total_pending: number;
  total_paid: number;
  invoices: InvoiceWithUrl[];
}

export type VendorDocumentWithUrl = VendorDocument & { downloadUrl?: string };

/** Mismos valores que en clientes, para que ambas pantallas hablen igual. */
export type DocStatus = 'complete' | 'incomplete' | 'no_required';

export type VendorListItem = Vendor & { docStatus: DocStatus };

export interface PaginatedVendors {
  data: VendorListItem[];
  nextCursor: string | null;
  total: number;
}

const DEFAULT_VENDORS_LIMIT = 20;

/**
 * Tipos de documento obligatorios para proveedor. Se repite como subconsulta en
 * dos lugares del CASE, así que vive aquí para que no se desincronicen.
 */
const REQUIRED_VENDOR_DOC_TYPES = `
  SELECT name FROM catalogs.document_types
  WHERE applies_to = 'vendor' AND is_required = true AND is_active = true
`;

@Injectable()
export class VendorsService {
  constructor(
    @InjectRepository(Vendor) private readonly vendorsRepository: Repository<Vendor>,
    @InjectRepository(VendorProduct) private readonly productsRepository: Repository<VendorProduct>,
    @InjectRepository(PurchaseOrder) private readonly purchaseOrdersRepository: Repository<PurchaseOrder>,
    @InjectRepository(Invoice) private readonly invoicesRepository: Repository<Invoice>,
    @InjectRepository(VendorDocument) private readonly documentsRepository: Repository<VendorDocument>,
    private readonly storageService: VendorStorageService,
  ) {}

  /**
   * El estado documental se calcula en SQL y no en memoria como en clientes:
   * con más de dos mil proveedores, traerlos todos junto a sus documentos para
   * agrupar en JavaScript hace crecer el costo con cada alta. Aquí el conteo de
   * obligatorios se resuelve una vez (CROSS JOIN de una fila) y el de subidos
   * en un solo agregado, de modo que filtrar por docStatus va en el WHERE y no
   * obliga a materializar el catálogo completo.
   */
  async findAll(query: QueryVendorsDto): Promise<PaginatedVendors> {
    const limit = query.limit ?? DEFAULT_VENDORS_LIMIT;

    const condiciones: string[] = ['v.deleted_at IS NULL'];
    const parametros: unknown[] = [];

    if (query.category_id) {
      parametros.push(query.category_id);
      condiciones.push(`v.category_id = $${parametros.length}`);
    }

    if (query.status) {
      parametros.push(query.status);
      condiciones.push(`v.status = $${parametros.length}`);
    }

    if (query.search) {
      parametros.push(`%${query.search}%`);
      const p = `$${parametros.length}`;
      condiciones.push(`(v.name ILIKE ${p} OR v.trade_name ILIKE ${p} OR v.rfc ILIKE ${p})`);
    }

    // doc_status se define en el SELECT, así que filtrar por él exige envolver
    // la consulta; se envuelve una vez y no se duplica el CASE.
    const filtrosExternos: string[] = [];
    if (query.docStatus) {
      parametros.push(query.docStatus);
      filtrosExternos.push(`q.doc_status = $${parametros.length}`);
    }

    const base = `
      SELECT
        v.id, v.name, v.trade_name, v.rfc, v.category_id, v.status,
        v.payment_terms_days, v.clabe, v.bank_name, v.bank_account, v.notes,
        v.created_at, v.updated_at, v.deleted_at, v.created_by, v.updated_by,
        CASE
          WHEN req.total = 0 THEN 'no_required'
          WHEN COALESCE(doc.uploaded, 0) >= req.total THEN 'complete'
          ELSE 'incomplete'
        END AS doc_status
      FROM vendors.vendors v
      CROSS JOIN (
        SELECT COUNT(*)::int AS total FROM catalogs.document_types
        WHERE applies_to = 'vendor' AND is_required = true AND is_active = true
      ) req
      LEFT JOIN (
        SELECT vendor_id, COUNT(DISTINCT type)::int AS uploaded
        FROM vendors.vendor_documents
        WHERE deleted_at IS NULL AND type IN (${REQUIRED_VENDOR_DOC_TYPES})
        GROUP BY vendor_id
      ) doc ON doc.vendor_id = v.id
      WHERE ${condiciones.join(' AND ')}
    `;

    const whereExterno = (extra: string[]) => {
      const todos = [...filtrosExternos, ...extra];
      return todos.length ? `WHERE ${todos.join(' AND ')}` : '';
    };

    // El total se calcula sin el cursor: es el tamaño del resultado filtrado, no
    // lo que resta por recorrer, para que no encoja al avanzar de página.
    const totalRows = (await this.vendorsRepository.query(
      `SELECT COUNT(*)::int AS total FROM (${base}) q ${whereExterno([])}`,
      parametros,
    )) as { total: number }[];
    const total = totalRows[0]?.total ?? 0;

    const condicionesPagina: string[] = [];
    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      parametros.push(cursor.createdAt, cursor.id);
      const pCreated = `$${parametros.length - 1}`;
      const pId = `$${parametros.length}`;
      // Orden estable por (created_at, id): sin el desempate por id, dos
      // proveedores con el mismo timestamp podrían repetirse o saltarse entre
      // páginas. La carga masiva dejó miles de filas con created_at casi igual.
      condicionesPagina.push(
        `(q.created_at < ${pCreated}::timestamptz OR (q.created_at = ${pCreated}::timestamptz AND q.id < ${pId}::uuid))`,
      );
    }

    parametros.push(limit + 1); // una de más para saber si hay siguiente página
    const filas = (await this.vendorsRepository.query(
      `
      SELECT q.*, q.created_at::text AS cursor_created_at
      FROM (${base}) q
      ${whereExterno(condicionesPagina)}
      ORDER BY q.created_at DESC, q.id DESC
      LIMIT $${parametros.length}
      `,
      parametros,
    )) as Record<string, unknown>[];

    const hayMas = filas.length > limit;
    const pagina = hayMas ? filas.slice(0, limit) : filas;
    const ultima = pagina[pagina.length - 1];

    return {
      data: pagina.map((f) => this.toVendorListItem(f)),
      // El cursor lleva created_at como texto de Postgres, con microsegundos.
      // Pasarlo por Date lo truncaría a milisegundos y, como la carga masiva
      // dejó miles de filas dentro del mismo milisegundo, cada salto de página
      // se comía las que caían entre el milisegundo y el microsegundo exactos.
      nextCursor:
        hayMas && ultima
          ? encodeCursor({
              createdAt: ultima.cursor_created_at as string,
              id: ultima.id as string,
            })
          : null,
      total,
    };
  }

  /** El SQL crudo devuelve snake_case; la API expone camelCase. */
  private toVendorListItem(fila: Record<string, unknown>): VendorListItem {
    return {
      id: fila.id,
      name: fila.name,
      tradeName: fila.trade_name,
      rfc: fila.rfc,
      categoryId: fila.category_id,
      status: fila.status,
      paymentTermsDays: fila.payment_terms_days,
      clabe: fila.clabe,
      bankName: fila.bank_name,
      bankAccount: fila.bank_account,
      notes: fila.notes,
      createdAt: fila.created_at,
      updatedAt: fila.updated_at,
      deletedAt: fila.deleted_at,
      createdBy: fila.created_by,
      updatedBy: fila.updated_by,
      docStatus: fila.doc_status,
    } as VendorListItem;
  }

  async create(dto: CreateVendorDto, userId: string): Promise<Vendor> {
    const vendor = this.vendorsRepository.create({
      name: dto.name,
      tradeName: dto.trade_name ?? null,
      rfc: dto.rfc,
      categoryId: dto.category_id ?? null,
      status: dto.status ?? VendorStatus.ACTIVO,
      paymentTermsDays: dto.payment_terms_days ?? 30,
      clabe: dto.clabe ?? null,
      bankName: dto.bank_name ?? null,
      bankAccount: dto.bank_account ?? null,
      notes: dto.notes ?? null,
      createdBy: userId,
      updatedBy: userId,
    });

    return this.vendorsRepository.save(vendor);
  }

  async findOne(id: string): Promise<Vendor> {
    const vendor = await this.vendorsRepository.findOne({
      where: { id },
      relations: { products: true, purchaseOrders: true, invoices: true, documents: true },
    });

    if (!vendor) {
      throw new NotFoundException(`Proveedor ${id} no encontrado`);
    }

    return vendor;
  }

  async update(id: string, dto: UpdateVendorDto, userId: string): Promise<Vendor> {
    const vendor = await this.getVendorOrFail(id);

    if (dto.name !== undefined) vendor.name = dto.name;
    if (dto.trade_name !== undefined) vendor.tradeName = dto.trade_name ?? null;
    if (dto.rfc !== undefined) vendor.rfc = dto.rfc;
    if (dto.category_id !== undefined) vendor.categoryId = dto.category_id ?? null;
    if (dto.status !== undefined) vendor.status = dto.status;
    if (dto.payment_terms_days !== undefined) vendor.paymentTermsDays = dto.payment_terms_days;
    if (dto.clabe !== undefined) vendor.clabe = dto.clabe ?? null;
    if (dto.bank_name !== undefined) vendor.bankName = dto.bank_name ?? null;
    if (dto.bank_account !== undefined) vendor.bankAccount = dto.bank_account ?? null;
    if (dto.notes !== undefined) vendor.notes = dto.notes ?? null;
    vendor.updatedBy = userId;

    return this.vendorsRepository.save(vendor);
  }

  async getProducts(vendorId: string): Promise<VendorProduct[]> {
    await this.getVendorOrFail(vendorId);
    return this.productsRepository.find({ where: { vendorId }, order: { createdAt: 'DESC' } });
  }

  async addProduct(vendorId: string, dto: CreateProductDto, userId: string): Promise<VendorProduct> {
    await this.getVendorOrFail(vendorId);

    const product = this.productsRepository.create({
      vendorId,
      name: dto.name,
      type: dto.type,
      description: dto.description ?? null,
      unitPrice: dto.unit_price !== undefined ? dto.unit_price.toFixed(2) : null,
      currency: dto.currency ?? 'MXN',
      isActive: dto.is_active ?? true,
      createdBy: userId,
    });

    return this.productsRepository.save(product);
  }

  async getPurchaseOrders(vendorId: string, query: QueryPurchaseOrdersDto): Promise<PurchaseOrder[]> {
    await this.getVendorOrFail(vendorId);

    const qb = this.purchaseOrdersRepository
      .createQueryBuilder('po')
      .where('po.vendorId = :vendorId', { vendorId })
      .orderBy('po.createdAt', 'DESC');

    if (query.status) {
      qb.andWhere('po.status = :status', { status: query.status });
    }

    return qb.getMany();
  }

  async getInvoices(vendorId: string, query: QueryInvoicesDto): Promise<InvoiceWithUrl[]> {
    await this.getVendorOrFail(vendorId);

    const qb = this.invoicesRepository
      .createQueryBuilder('invoice')
      .where('invoice.vendorId = :vendorId', { vendorId })
      .orderBy('invoice.issueDate', 'DESC');

    if (query.status) {
      qb.andWhere('invoice.status = :status', { status: query.status });
    }

    const invoices = await qb.getMany();
    return Promise.all(invoices.map((invoice) => this.attachPdfUrl(invoice)));
  }

  async getStatement(vendorId: string): Promise<VendorStatement> {
    await this.getVendorOrFail(vendorId);

    const invoices = await this.invoicesRepository.find({
      where: { vendorId },
      relations: { payments: true },
      order: { issueDate: 'DESC' },
    });

    let totalPending = 0;
    let totalPaid = 0;

    for (const invoice of invoices) {
      const total = Number(invoice.total);
      if (invoice.status === InvoiceStatus.PAGADA) {
        totalPaid += total;
      } else {
        totalPending += total;
      }
    }

    const invoicesWithUrl = await Promise.all(invoices.map((invoice) => this.attachPdfUrl(invoice)));

    return { total_pending: totalPending, total_paid: totalPaid, invoices: invoicesWithUrl };
  }

  private async attachPdfUrl(invoice: Invoice): Promise<InvoiceWithUrl> {
    if (!invoice.pdfS3Key) {
      return invoice;
    }
    const pdfUrl = await this.storageService.getPresignedUrl(invoice.pdfS3Key);
    return { ...invoice, pdfUrl };
  }

  async uploadDocument(
    vendorId: string,
    file: Express.Multer.File,
    dto: UploadVendorDocumentDto,
    userId: string,
  ): Promise<VendorDocumentWithUrl> {
    await this.getVendorOrFail(vendorId);

    const s3Key = await this.storageService.uploadDocument(file, vendorId, dto.type);

    const document = this.documentsRepository.create({
      vendorId,
      type: dto.type,
      name: dto.name,
      s3Key,
      fileSize: file.size,
      uploadedBy: userId,
    });

    const saved = await this.documentsRepository.save(document);
    const downloadUrl = await this.storageService.getPresignedUrl(saved.s3Key);
    return { ...saved, downloadUrl };
  }

  /** Paso 1 del upload directo: valida tipo/tamaño declarados y firma la URL. */
  async createPresignedUpload(
    vendorId: string,
    dto: PresignedUploadDto,
  ): Promise<{ uploadUrl: string; s3Key: string }> {
    await this.getVendorOrFail(vendorId);
    assertUploadAllowed(dto.fileType, dto.fileSize, ALLOWED_DOCUMENT_MIME_TYPES);

    return this.storageService.getPresignedUploadUrl(dto.fileName, dto.fileType, vendorId);
  }

  /**
   * Paso 3: el objeto ya está en S3. Revalida tipo, pertenencia de la key y el
   * tamaño REAL del objeto, porque el declarado viene del navegador.
   */
  async registerDocument(
    vendorId: string,
    dto: RegisterVendorDocumentDto,
    userId: string,
  ): Promise<VendorDocumentWithUrl> {
    await this.getVendorOrFail(vendorId);
    assertUploadAllowed(dto.fileType, dto.fileSize, ALLOWED_DOCUMENT_MIME_TYPES);
    assertKeyInPrefix(dto.s3Key, VendorStorageService.documentPrefix(vendorId));

    const actualSize = await this.storageService.getObjectSize(dto.s3Key);
    if (actualSize === null) {
      throw new BadRequestException('El archivo no se encontró en el almacenamiento');
    }
    if (actualSize > MAX_UPLOAD_BYTES) {
      await this.storageService.deleteDocument(dto.s3Key);
      throw new BadRequestException(
        `El archivo no puede superar ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`,
      );
    }

    const document = this.documentsRepository.create({
      vendorId,
      type: dto.type,
      name: dto.name,
      s3Key: dto.s3Key,
      fileSize: actualSize,
      uploadedBy: userId,
    });

    const saved = await this.documentsRepository.save(document);
    const downloadUrl = await this.storageService.getPresignedUrl(saved.s3Key);
    return { ...saved, downloadUrl };
  }

  async getDocuments(vendorId: string): Promise<VendorDocumentWithUrl[]> {
    await this.getVendorOrFail(vendorId);
    const documents = await this.documentsRepository.find({ where: { vendorId }, order: { uploadedAt: 'DESC' } });

    return Promise.all(
      documents.map(async (document) => ({
        ...document,
        downloadUrl: await this.storageService.getPresignedUrl(document.s3Key),
      })),
    );
  }

  async remove(id: string): Promise<void> {
    const vendor = await this.getVendorOrFail(id);
    await this.vendorsRepository.softRemove(vendor);
  }

  async removeDocument(docId: string): Promise<void> {
    const document = await this.documentsRepository.findOne({ where: { id: docId } });
    if (!document) {
      throw new NotFoundException(`Documento ${docId} no encontrado`);
    }

    await this.storageService.deleteDocument(document.s3Key);
    await this.documentsRepository.softRemove(document);
  }

  private async getVendorOrFail(id: string): Promise<Vendor> {
    const vendor = await this.vendorsRepository.findOne({ where: { id } });
    if (!vendor) {
      throw new NotFoundException(`Proveedor ${id} no encontrado`);
    }
    return vendor;
  }
}
