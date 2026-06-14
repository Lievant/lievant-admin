import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './entities/invoice.entity';
import { POLineItem } from './entities/po-line-item.entity';
import { Payment } from './entities/payment.entity';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { Vendor } from './entities/vendor.entity';
import { VendorDocument } from './entities/vendor-document.entity';
import { VendorProduct } from './entities/vendor-product.entity';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { VendorStorageService } from './vendor-storage.service';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vendor, VendorProduct, PurchaseOrder, POLineItem, Invoice, Payment, VendorDocument]),
  ],
  controllers: [VendorsController, PurchaseOrdersController, InvoicesController],
  providers: [VendorsService, PurchaseOrdersService, InvoicesService, VendorStorageService],
  exports: [VendorsService],
})
export class VendorsModule {}
