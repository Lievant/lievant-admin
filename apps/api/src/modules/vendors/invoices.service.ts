import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { Payment } from './entities/payment.entity';
import { POStatus, PurchaseOrder } from './entities/purchase-order.entity';
import { VendorStorageService } from './vendor-storage.service';

export type InvoiceWithUrl = Invoice & { pdfUrl?: string };

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice) private readonly invoicesRepository: Repository<Invoice>,
    private readonly dataSource: DataSource,
    private readonly storageService: VendorStorageService,
  ) {}

  async findAll(query: QueryInvoicesDto): Promise<InvoiceWithUrl[]> {
    const qb = this.invoicesRepository.createQueryBuilder('invoice').orderBy('invoice.issueDate', 'DESC');

    if (query.vendor_id) {
      qb.andWhere('invoice.vendorId = :vendorId', { vendorId: query.vendor_id });
    }

    if (query.status) {
      qb.andWhere('invoice.status = :status', { status: query.status });
    }

    if (query.date_from) {
      qb.andWhere('invoice.issueDate >= :dateFrom', { dateFrom: query.date_from });
    }

    if (query.date_to) {
      qb.andWhere('invoice.issueDate <= :dateTo', { dateTo: query.date_to });
    }

    const invoices = await qb.getMany();
    return Promise.all(invoices.map((invoice) => this.attachPdfUrl(invoice)));
  }

  async create(dto: CreateInvoiceDto, userId: string): Promise<InvoiceWithUrl> {
    const invoice = this.invoicesRepository.create({
      vendorId: dto.vendor_id,
      poId: dto.po_id ?? null,
      invoiceNumber: dto.invoice_number,
      amount: dto.amount.toFixed(2),
      tax: (dto.tax ?? 0).toFixed(2),
      total: dto.total.toFixed(2),
      issueDate: dto.issue_date,
      dueDate: dto.due_date ?? null,
      notes: dto.notes ?? null,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.invoicesRepository.save(invoice);
    return this.attachPdfUrl(saved);
  }

  async findOne(id: string): Promise<InvoiceWithUrl> {
    const invoice = await this.invoicesRepository.findOne({
      where: { id },
      relations: { payments: true },
    });

    if (!invoice) {
      throw new NotFoundException(`Factura ${id} no encontrada`);
    }

    return this.attachPdfUrl(invoice);
  }

  async updatePdf(id: string, file: Express.Multer.File): Promise<InvoiceWithUrl> {
    const invoice = await this.getInvoiceOrFail(id);

    const pdfS3Key = await this.storageService.uploadInvoicePdf(file, id);
    invoice.pdfS3Key = pdfS3Key;

    const saved = await this.invoicesRepository.save(invoice);
    return this.attachPdfUrl(saved);
  }

  async registerPayment(
    id: string,
    dto: RegisterPaymentDto,
    userId: string,
    voucherFile?: Express.Multer.File,
  ): Promise<InvoiceWithUrl> {
    const invoice = await this.getInvoiceOrFail(id);

    if (invoice.status === InvoiceStatus.PAGADA) {
      throw new BadRequestException('La factura ya está marcada como pagada');
    }

    const voucherS3Key = voucherFile ? await this.storageService.uploadPaymentVoucher(voucherFile, id) : null;

    await this.dataSource.transaction(async (manager) => {
      const payment = manager.create(Payment, {
        invoiceId: invoice.id,
        amount: dto.amount.toFixed(2),
        paymentDate: dto.payment_date,
        paymentMethod: dto.payment_method ?? null,
        reference: dto.reference ?? null,
        voucherS3Key,
        notes: dto.notes ?? null,
        createdBy: userId,
      });
      await manager.save(payment);

      invoice.status = InvoiceStatus.PAGADA;
      invoice.updatedBy = userId;
      await manager.save(invoice);

      if (invoice.poId) {
        const pendingInvoices = await manager.count(Invoice, {
          where: { poId: invoice.poId, status: InvoiceStatus.PENDIENTE },
        });

        if (pendingInvoices === 0) {
          await manager.update(
            PurchaseOrder,
            { id: invoice.poId },
            { status: POStatus.CERRADA, closedAt: new Date(), updatedBy: userId },
          );
        }
      }
    });

    return this.findOne(id);
  }

  private async attachPdfUrl(invoice: Invoice): Promise<InvoiceWithUrl> {
    if (!invoice.pdfS3Key) {
      return invoice;
    }
    const pdfUrl = await this.storageService.getPresignedUrl(invoice.pdfS3Key);
    return { ...invoice, pdfUrl };
  }

  private async getInvoiceOrFail(id: string): Promise<Invoice> {
    const invoice = await this.invoicesRepository.findOne({ where: { id } });
    if (!invoice) {
      throw new NotFoundException(`Factura ${id} no encontrada`);
    }
    return invoice;
  }
}
