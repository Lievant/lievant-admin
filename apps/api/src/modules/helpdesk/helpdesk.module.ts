import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { HelpdeskCategory } from './entities/category.entity';
import { HelpdeskSubcategory } from './entities/subcategory.entity';
import { Ticket } from './entities/ticket.entity';
import { TicketAssignee } from './entities/ticket-assignee.entity';
import { TicketAttachment } from './entities/ticket-attachment.entity';
import { TicketHistory } from './entities/ticket-history.entity';
import { HelpdeskStorageService } from './helpdesk-storage.service';
import { HelpdeskController } from './helpdesk.controller';
import { HelpdeskService } from './helpdesk.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Ticket,
      TicketAssignee,
      TicketHistory,
      TicketAttachment,
      HelpdeskCategory,
      HelpdeskSubcategory,
      EmployeeRecord,
      User,
    ]),
  ],
  controllers: [HelpdeskController],
  providers: [HelpdeskService, HelpdeskStorageService],
  exports: [HelpdeskService],
})
export class HelpdeskModule {}
