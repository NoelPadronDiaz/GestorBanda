import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { PayrollModule } from '../payroll/payroll.module';
import { TaxController } from './tax.controller';
import { TaxService } from './tax.service';

/** Fiscalidad: libro de IGIC trimestral y retenciones IRPF (informes de apoyo para la gestoría). */
@Module({
  imports: [BillingModule, PayrollModule],
  controllers: [TaxController],
  providers: [TaxService],
})
export class TaxModule {}
