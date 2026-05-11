import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../auth/decorators/user.decorator';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { UserRole } from '../common/enums/user-role.enum';
import { AuditService } from './audit.service';
import { QueryAuditDto } from './dto/query-audit.dto';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get('applications/:applicationId/audit-log')
  @Roles(
    UserRole.APPLICANT,
    UserRole.REVIEWER,
    UserRole.APPROVER,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Get audit log for specific application' })
  @ApiParam({ name: 'applicationId' })
  findByApplication(
    @User() user: CurrentUser,
    @Param('applicationId') applicationId: string,
    @Query() query: QueryAuditDto,
  ) {
    return this.service.findByApplication(user, applicationId, query);
  }

  @Get('audit-log')
  @Roles(UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get global audit log (REVIEWER/APPROVER/ADMIN)' })
  findAll(@User() user: CurrentUser, @Query() query: QueryAuditDto) {
    return this.service.findAll(user, query);
  }

  @Get('audit-log/verify')
  @Roles(UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Verify tamper-evident audit chain' })
  verifyChain() {
    return this.service.verifyChain();
  }
}
