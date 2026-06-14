import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { QueryPurchaseOrdersDto } from './dto/query-purchase-orders.dto';
import { UpdatePoStatusDto } from './dto/update-po-status.dto';
import { POLineItem } from './entities/po-line-item.entity';
import { POStatus, PurchaseOrder } from './entities/purchase-order.entity';

const ALLOWED_TRANSITIONS: Record<POStatus, POStatus[]> = {
  [POStatus.BORRADOR]: [POStatus.APROBADA],
  [POStatus.APROBADA]: [POStatus.CERRADA],
  [POStatus.CERRADA]: [],
};

@Injectable()
export class PurchaseOrdersService {
  constructor(
    @InjectRepository(PurchaseOrder) private readonly purchaseOrdersRepository: Repository<PurchaseOrder>,
    @InjectRepository(POLineItem) private readonly lineItemsRepository: Repository<POLineItem>,
  ) {}

  async findAll(query: QueryPurchaseOrdersDto): Promise<PurchaseOrder[]> {
    const qb = this.purchaseOrdersRepository.createQueryBuilder('po').orderBy('po.createdAt', 'DESC');

    if (query.vendor_id) {
      qb.andWhere('po.vendorId = :vendorId', { vendorId: query.vendor_id });
    }

    if (query.status) {
      qb.andWhere('po.status = :status', { status: query.status });
    }

    return qb.getMany();
  }

  async create(dto: CreatePurchaseOrderDto, userId: string): Promise<PurchaseOrder> {
    const poNumber = await this.generatePoNumber();

    let subtotal = 0;
    const lineItems = dto.line_items.map((item, index) => {
      const total = item.quantity * item.unit_price;
      subtotal += total;

      return this.lineItemsRepository.create({
        productId: item.product_id ?? null,
        description: item.description,
        quantity: item.quantity.toFixed(2),
        unitPrice: item.unit_price.toFixed(2),
        total: total.toFixed(2),
        sortOrder: index,
      });
    });

    const tax = 0;
    const total = subtotal + tax;

    const purchaseOrder = await this.purchaseOrdersRepository.save(
      this.purchaseOrdersRepository.create({
        poNumber,
        vendorId: dto.vendor_id,
        notes: dto.notes ?? null,
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
        createdBy: userId,
        updatedBy: userId,
      }),
    );

    for (const lineItem of lineItems) {
      lineItem.poId = purchaseOrder.id;
    }
    await this.lineItemsRepository.save(lineItems);

    return this.findOne(purchaseOrder.id);
  }

  async findOne(id: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.purchaseOrdersRepository.findOne({
      where: { id },
      relations: { lineItems: true },
    });

    if (!purchaseOrder) {
      throw new NotFoundException(`Orden de compra ${id} no encontrada`);
    }

    return purchaseOrder;
  }

  async updateStatus(id: string, dto: UpdatePoStatusDto, userId: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.getPurchaseOrderOrFail(id);

    const allowed = ALLOWED_TRANSITIONS[purchaseOrder.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `No se puede cambiar el estado de la orden de compra de '${purchaseOrder.status}' a '${dto.status}'`,
      );
    }

    purchaseOrder.status = dto.status;
    purchaseOrder.updatedBy = userId;

    if (dto.status === POStatus.APROBADA) {
      purchaseOrder.approvedAt = new Date();
    }

    if (dto.status === POStatus.CERRADA) {
      purchaseOrder.closedAt = new Date();
    }

    return this.purchaseOrdersRepository.save(purchaseOrder);
  }

  private async generatePoNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `OC-${year}-`;

    const last = await this.purchaseOrdersRepository
      .createQueryBuilder('po')
      .where('po.poNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('po.poNumber', 'DESC')
      .limit(1)
      .getOne();

    const lastNumber = last ? parseInt(last.poNumber.replace(prefix, ''), 10) || 0 : 0;
    return `${prefix}${String(lastNumber + 1).padStart(3, '0')}`;
  }

  private async getPurchaseOrderOrFail(id: string): Promise<PurchaseOrder> {
    const purchaseOrder = await this.purchaseOrdersRepository.findOne({ where: { id } });
    if (!purchaseOrder) {
      throw new NotFoundException(`Orden de compra ${id} no encontrada`);
    }
    return purchaseOrder;
  }
}
