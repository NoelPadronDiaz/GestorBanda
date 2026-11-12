import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import {
  ExpensesController,
  RecurringExpensesController,
  SuppliersController,
} from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { RecurringExpensesService } from './recurring.service';
import { SuppliersService } from './suppliers.service';

/** Facturación y gastos: clientes, facturas emitidas (ALC/ESC), proveedores, gastos y recurrentes. */
@Module({
  controllers: [
    ClientsController,
    InvoicesController,
    SuppliersController,
    ExpensesController,
    RecurringExpensesController,
  ],
  providers: [
    ClientsService,
    InvoicesService,
    SuppliersService,
    ExpensesService,
    RecurringExpensesService,
  ],
  exports: [InvoicesService, ExpensesService, RecurringExpensesService],
})
export class BillingModule {}
