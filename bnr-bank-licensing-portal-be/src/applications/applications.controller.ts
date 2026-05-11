import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../auth/decorators/user.decorator';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { UserRole } from '../common/enums/user-role.enum';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { QueryApplicationsDto } from './dto/query-applications.dto';
import {
  CompleteReviewDto,
  DecisionDto,
  RequestInfoDto,
} from './dto/transition.dto';

function extractCtx(req: Request) {
  return {
    requestId: req.headers['x-request-id'] as string | undefined,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

@ApiTags('Applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  @Post()
  @Roles(UserRole.APPLICANT)
  @ApiOperation({ summary: 'Create a new application (APPLICANT)' })
  create(@User() user: CurrentUser, @Body() dto: CreateApplicationDto) {
    return this.service.create(user, dto);
  }

  @Get()
  @Roles(
    UserRole.APPLICANT,
    UserRole.REVIEWER,
    UserRole.APPROVER,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'List applications (role-filtered)' })
  findAll(@User() user: CurrentUser, @Query() query: QueryApplicationsDto) {
    return this.service.findAll(user, query);
  }

  @Get(':id')
  @Roles(
    UserRole.APPLICANT,
    UserRole.REVIEWER,
    UserRole.APPROVER,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Get application by ID' })
  @ApiParam({ name: 'id', description: 'Application ID' })
  findOne(@User() user: CurrentUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Post(':id/submit')
  @Roles(UserRole.APPLICANT)
  @ApiOperation({ summary: 'Submit application for review (APPLICANT)' })
  @ApiParam({ name: 'id', description: 'Application ID' })
  submit(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.service.submit(user, id, extractCtx(req));
  }

  @Post(':id/review/start')
  @Roles(UserRole.REVIEWER)
  @ApiOperation({ summary: 'Start reviewing application (REVIEWER)' })
  @ApiParam({ name: 'id', description: 'Application ID' })
  startReview(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.service.startReview(user, id, extractCtx(req));
  }

  @Post(':id/review/request-info')
  @Roles(UserRole.REVIEWER)
  @ApiOperation({
    summary: 'Request additional information from applicant (REVIEWER)',
  })
  @ApiParam({ name: 'id', description: 'Application ID' })
  requestInfo(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: RequestInfoDto,
    @Req() req: Request,
  ) {
    return this.service.requestInfo(user, id, dto.notes, extractCtx(req));
  }

  @Post(':id/resubmit')
  @Roles(UserRole.APPLICANT)
  @ApiOperation({
    summary: 'Resubmit application after info request (APPLICANT)',
  })
  @ApiParam({ name: 'id', description: 'Application ID' })
  resubmit(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.service.resubmit(user, id, extractCtx(req));
  }

  @Post(':id/review/complete')
  @Roles(UserRole.REVIEWER)
  @ApiOperation({ summary: 'Mark review as complete (REVIEWER)' })
  @ApiParam({ name: 'id', description: 'Application ID' })
  completeReview(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: CompleteReviewDto,
    @Req() req: Request,
  ) {
    return this.service.completeReview(
      user,
      id,
      dto.reviewComment,
      extractCtx(req),
    );
  }

  @Post(':id/decision')
  @Roles(UserRole.APPROVER)
  @ApiOperation({ summary: 'Approve or reject application (APPROVER)' })
  @ApiParam({ name: 'id', description: 'Application ID' })
  decide(
    @User() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: DecisionDto & { decision: 'APPROVED' | 'REJECTED' },
    @Req() req: Request,
  ) {
    if (!dto.decision || !['APPROVED', 'REJECTED'].includes(dto.decision)) {
      throw new BadRequestException('decision must be APPROVED or REJECTED');
    }
    return this.service.decide(
      user,
      id,
      dto.decision,
      dto.rejectionReason,
      extractCtx(req),
    );
  }
}
