import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RequestContextMiddleware } from './common/context/request-context.middleware';
import { RequestContextModule } from './common/context/request-context.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { validateEnv } from './config/env';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './modules/auth/guards/permissions.guard';
import { BandProfileModule } from './modules/band-profile/band-profile.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { BillingModule } from './modules/billing/billing.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { GrantsModule } from './modules/grants/grants.module';
import { InternalCashModule } from './modules/internal-cash/internal-cash.module';
import { MembersModule } from './modules/members/members.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { SchoolModule } from './modules/school/school.module';
import { TaxModule } from './modules/tax/tax.module';
import { TreasuryModule } from './modules/treasury/treasury.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    RequestContextModule,
    PrismaModule,
    AuditModule,
    AuthModule,
    BandProfileModule,
    MembersModule,
    DocumentsModule,
    // Gestión económica
    BillingModule,
    SchoolModule,
    PayrollModule,
    AccountingModule,
    TreasuryModule,
    BudgetsModule,
    TaxModule,
    GrantsModule,
    InternalCashModule,
    DashboardModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Seguridad por defecto, en este orden: límite de peticiones → autenticación → permisos.
    // Toda ruta exige un JWT válido salvo las marcadas con @Public().
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes({ path: '{*splat}', method: RequestMethod.ALL });
  }
}
