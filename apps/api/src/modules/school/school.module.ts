import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { MembersModule } from '../members/members.module';
import { SchoolController } from './school.controller';
import { SchoolService } from './school.service';

@Module({
  imports: [BillingModule, MembersModule],
  controllers: [SchoolController],
  providers: [SchoolService],
  exports: [SchoolService],
})
export class SchoolModule {}
