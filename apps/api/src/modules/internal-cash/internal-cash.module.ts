import { Module } from '@nestjs/common';
import { InternalCashController } from './internal-cash.controller';
import { InternalCashService } from './internal-cash.service';

@Module({
  controllers: [InternalCashController],
  providers: [InternalCashService],
})
export class InternalCashModule {}
