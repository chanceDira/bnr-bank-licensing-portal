import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { WorkflowModule } from '../workflow/workflow.module';
import { RiskModule } from '../risk/risk.module';

@Module({
  imports: [WorkflowModule, RiskModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
