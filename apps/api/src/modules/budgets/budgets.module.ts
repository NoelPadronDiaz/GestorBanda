import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';

/** Presupuestos anuales por actividad, comparados con lo contabilizado en el diario. */
@Module({
  imports: [AccountingModule],
  controllers: [BudgetsController],
  providers: [BudgetsService],
})
export class BudgetsModule {}
