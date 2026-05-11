import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WorkflowModule } from './workflow/workflow.module';
import { ApplicationsModule } from './applications/applications.module';
import { DocumentsModule } from './documents/documents.module';
import { AuditModule } from './audit/audit.module';
import { RiskModule } from './risk/risk.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    PrismaModule,
    UsersModule,
    AuthModule,
    WorkflowModule,
    ApplicationsModule,
    DocumentsModule,
    AuditModule,
    RiskModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
