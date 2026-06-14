import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { QueryPurchaseOrdersDto } from './dto/query-purchase-orders.dto';
import { QueryVendorsDto } from './dto/query-vendors.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { UploadVendorDocumentDto } from './dto/upload-vendor-document.dto';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { Vendor, VendorStatus } from './entities/vendor.entity';
import { VendorDocument } from './entities/vendor-document.entity';
import { VendorProduct } from './entities/vendor-product.entity';
import { VendorStorageService } from './vendor-storage.service';

export type InvoiceWithUrl = Invoice & { pdfUrl?: string };

export interface VendorStatement {
  total_pending: number;
  total_paid: number;
  invoices: InvoiceWithUrl[];
}

export type VendorDocumentWithUrl = VendorDocument & { downloadUrl?: string };

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

  async findAll(query: QueryVendorsDto): Promise<Vendor[]> {
    const qb = this.vendorsRepository.createQueryBuilder('vendor').orderBy('vendor.createdAt', 'DESC');

    if (query.category_id) {
      qb.andWhere('vendor.categoryId = :categoryId', { categoryId: query.category_id });
    }

    if (query.status) {
      qb.andWhere('vendor.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere('(vendor.name ILIKE :search OR vendor.tradeName ILIKE :search OR vendor.rfc ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    return qb.getMany();
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
