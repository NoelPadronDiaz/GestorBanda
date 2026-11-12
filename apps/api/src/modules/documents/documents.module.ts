import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { MembersModule } from '../members/members.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { StorageService } from './storage.service';

@Module({
  imports: [MembersModule, BillingModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, StorageService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
