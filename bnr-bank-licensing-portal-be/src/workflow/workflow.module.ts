import { Module } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { AuditModule } from '../audit/audit.module';
import { RiskModule } from '../risk/risk.module';

@Module({
  imports: [AuditModule, RiskModule],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
