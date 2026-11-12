import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { PayrollModule } from '../payroll/payroll.module';
import { AccountingController } from './accounting.controller';
import { FiscalYearsService } from './fiscal-years.service';
import { JournalService } from './journal.service';

/** Contabilidad: plan de cuentas, diario, mayor, informes y cierre de ejercicios. */
@Module({
  imports: [BillingModule, PayrollModule],
  controllers: [AccountingController],
  providers: [JournalService, FiscalYearsService],
  exports: [JournalService],
})
export class AccountingModule {}
