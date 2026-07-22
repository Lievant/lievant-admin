import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeRecord } from '../employees/entities/employee-record.entity';
import { Conversation } from './entities/conversation.entity';
import { DocumentChunk } from './entities/document-chunk.entity';
import { IsobotDocument } from './entities/document.entity';
import { IsobotMessage } from './entities/message.entity';
import { IsobotController } from './isobot.controller';
import { IsobotIngestionService } from './isobot-ingestion.service';
import { IsobotService } from './isobot.service';
import { IsobotStorageService } from './isobot-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IsobotDocument, DocumentChunk, Conversation, IsobotMessage, EmployeeRecord]),
  ],
  controllers: [IsobotController],
  providers: [IsobotService, IsobotIngestionService, IsobotStorageService],
  exports: [IsobotService, IsobotIngestionService],
})
export class IsobotModule {}
