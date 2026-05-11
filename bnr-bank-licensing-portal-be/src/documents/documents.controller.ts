import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from '../auth/decorators/user.decorator';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { UserRole } from '../common/enums/user-role.enum';
import { DocumentsService } from './documents.service';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('applications/:applicationId/documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Post()
  @Roles(UserRole.APPLICANT)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload document for application (APPLICANT)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiParam({ name: 'applicationId' })
  upload(
    @User() user: CurrentUser,
    @Param('applicationId') applicationId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Document file is required');
    }

    return this.service.upload(user, applicationId, file);
  }

  @Get()
  @Roles(
    UserRole.APPLICANT,
    UserRole.REVIEWER,
    UserRole.APPROVER,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'List documents for application' })
  @ApiParam({ name: 'applicationId' })
  findAll(
    @User() user: CurrentUser,
    @Param('applicationId') applicationId: string,
  ) {
    return this.service.findByApplication(user, applicationId);
  }

  @Get(':documentId')
  @Roles(
    UserRole.APPLICANT,
    UserRole.REVIEWER,
    UserRole.APPROVER,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Get document metadata' })
  @ApiParam({ name: 'applicationId' })
  @ApiParam({ name: 'documentId' })
  findOne(
    @User() user: CurrentUser,
    @Param('applicationId') applicationId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.service.findOne(user, applicationId, documentId);
  }

  @Get(':documentId/download')
  @Roles(
    UserRole.APPLICANT,
    UserRole.REVIEWER,
    UserRole.APPROVER,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Download document file' })
  @ApiParam({ name: 'applicationId' })
  @ApiParam({ name: 'documentId' })
  async download(
    @User() user: CurrentUser,
    @Param('applicationId') applicationId: string,
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ) {
    const { stream, doc } = await this.service.downloadStream(
      user,
      applicationId,
      documentId,
    );

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(doc.fileName)}"`,
    );

    stream.pipe(res);
  }
}
