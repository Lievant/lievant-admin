import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { HelpdeskCategory } from './entities/category.entity';
import { HelpdeskSubcategory } from './entities/subcategory.entity';
import { Ticket } from './entities/ticket.entity';
import { TicketAttachment } from './entities/ticket-attachment.entity';
import { TicketHistory } from './entities/ticket-history.entity';
import { HelpdeskController } from './helpdesk.controller';
import { HelpdeskService } from './helpdesk.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Ticket,
      TicketHistory,
      TicketAttachment,
      HelpdeskCategory,
      HelpdeskSubcategory,
      EmployeeRecord,
    ]),
  ],
  controllers: [HelpdeskController],
  providers: [HelpdeskService],
  exports: [HelpdeskService],
})
export class HelpdeskModule {}
