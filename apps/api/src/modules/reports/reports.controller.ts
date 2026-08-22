import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RequirePermission } from '../auth/decorators/permission.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { DocumentStatusService } from './document-status.service';
import {
  QueryDocumentActivityDto,
  QueryDocumentEntitiesDto,
} from './dto/query-document-report.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('transformacion', 'reportes', 'read')
@Controller('reports')
export class ReportsController {
  constructor(private readonly documentStatus: DocumentStatusService) {}

  @Get('documents/summary')
  getSummary() {
    return this.documentStatus.getSummary();
  }

  @Get('documents/entities')
  getEntities(@Query() query: QueryDocumentEntitiesDto) {
    return this.documentStatus.getEntities(query);
  }

  @Get('documents/activity')
  getActivity(@Query() query: QueryDocumentActivityDto) {
    return this.documentStatus.getActivity(query);
  }
}
