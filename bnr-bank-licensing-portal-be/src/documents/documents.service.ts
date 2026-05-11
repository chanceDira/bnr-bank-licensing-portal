import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { UserRole } from '../common/enums/user-role.enum';
import { ApplicationStatus } from '../../generated/prisma/enums';
import { existsSync, mkdirSync, createReadStream } from 'fs';
import { join } from 'path';
import { readFile, unlink, writeFile } from 'fs/promises';
import { ReadStream } from 'fs';
import { createHash } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { RiskService } from '../risk/risk.service';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const STORAGE_ROOT = join(process.cwd(), 'storage');
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
]);

const UPLOADABLE_STATUSES = new Set<ApplicationStatus>([
  ApplicationStatus.DRAFT,
  ApplicationStatus.INFO_REQUESTED,
  ApplicationStatus.RESUBMITTED,
]);

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly risk: RiskService,
  ) {}

  async upload(
    user: CurrentUser,
    applicationId: string,
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Document file is required');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new PayloadTooLargeException('File exceeds the 5 MB limit');
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Unsupported document type');
    }

    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { applicantId: true, status: true, version: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (
      user.role === UserRole.APPLICANT &&
      application.applicantId !== user.id
    ) {
      throw new ForbiddenException('Access denied');
    }

    if (
      user.role === UserRole.APPLICANT &&
      !UPLOADABLE_STATUSES.has(application.status)
    ) {
      throw new BadRequestException(
        `Cannot upload documents when application is in ${application.status} status`,
      );
    }

    const dir = join(
      STORAGE_ROOT,
      'apps',
      applicationId,
      `v${application.version}`,
    );
    mkdirSync(dir, { recursive: true });

    const safeFilename = `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const storagePath = join(dir, safeFilename);
    const sha256Hash = this.sha256(file.buffer);

    await writeFile(storagePath, file.buffer);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const record = await tx.applicationFile.create({
          data: {
            applicationId,
            applicationVersion: application.version,
            fileName: file.originalname,
            mimeType: file.mimetype,
            fileSizeBytes: file.size,
            sha256Hash,
            storagePath,
            uploadedById: user.id,
          },
          include: { uploadedBy: { select: { id: true, email: true } } },
        });

        await this.audit.record(tx, {
          applicationId,
          actorUserId: user.id,
          action: 'DOCUMENT_UPLOADED',
          beforeStatus: application.status,
          afterStatus: application.status,
          metadata: {
            fileName: file.originalname,
            fileSizeBytes: file.size,
            documentId: record.id,
            applicationVersion: application.version,
            sha256Hash,
          },
        });

        await this.risk.updateApplicationRisk(tx, applicationId);

        return record;
      });
    } catch (error) {
      try {
        await unlink(storagePath);
      } catch {
        // Best effort cleanup: the database transaction is already rolled back.
      }

      throw error;
    }
  }

  async findByApplication(user: CurrentUser, applicationId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { applicantId: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (
      user.role === UserRole.APPLICANT &&
      application.applicantId !== user.id
    ) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.applicationFile.findMany({
      where: { applicationId },
      orderBy: [{ applicationVersion: 'asc' }, { createdAt: 'asc' }],
      include: { uploadedBy: { select: { id: true, email: true } } },
    });
  }

  async findOne(user: CurrentUser, applicationId: string, documentId: string) {
    const doc = await this.prisma.applicationFile.findUnique({
      where: { id: documentId },
      include: {
        application: { select: { applicantId: true } },
        uploadedBy: { select: { id: true, email: true } },
      },
    });

    if (!doc || doc.applicationId !== applicationId) {
      throw new NotFoundException('Document not found');
    }

    if (
      user.role === UserRole.APPLICANT &&
      doc.application.applicantId !== user.id
    ) {
      throw new ForbiddenException('Access denied');
    }

    return doc;
  }

  async downloadStream(
    user: CurrentUser,
    applicationId: string,
    documentId: string,
  ): Promise<{
    stream: ReadStream;
    doc: { fileName: string; mimeType: string };
  }> {
    const doc = await this.findOne(user, applicationId, documentId);

    if (!existsSync(doc.storagePath)) {
      throw new NotFoundException('File not found on storage');
    }

    if (doc.sha256Hash) {
      const currentHash = this.sha256(await readFile(doc.storagePath));
      if (currentHash !== doc.sha256Hash) {
        throw new ConflictException(
          'Stored file fingerprint does not match document metadata',
        );
      }
    }

    return {
      stream: createReadStream(doc.storagePath),
      doc: { fileName: doc.fileName, mimeType: doc.mimeType },
    };
  }

  private sha256(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }
}
