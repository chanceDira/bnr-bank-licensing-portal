import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = (request.headers['x-request-id'] as string) ?? 'unknown';

    let statusCode: number;
    let message: string;
    let code: string;
    let details: unknown;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
        code = exception.constructor.name
          .replace('Exception', '')
          .toUpperCase();
      } else {
        const resObj = res as Record<string, unknown>;
        message = (resObj.message as string) ?? exception.message;
        code =
          (resObj.code as string) ??
          exception.constructor.name.replace('Exception', '').toUpperCase();
        details = resObj.details;
      }
    } else if (
      typeof exception === 'object' &&
      exception !== null &&
      'name' in exception &&
      exception.name === 'MulterError'
    ) {
      const multerError = exception as { code?: string; message?: string };
      statusCode =
        multerError.code === 'LIMIT_FILE_SIZE'
          ? HttpStatus.PAYLOAD_TOO_LARGE
          : HttpStatus.BAD_REQUEST;
      message =
        multerError.code === 'LIMIT_FILE_SIZE'
          ? 'File exceeds the 5 MB limit'
          : (multerError.message ?? 'Invalid uploaded file');
      code =
        multerError.code === 'LIMIT_FILE_SIZE'
          ? 'PAYLOAD_TOO_LARGE'
          : 'BAD_REQUEST';
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected error occurred';
      code = 'INTERNAL_SERVER_ERROR';
      this.logger.error(
        `Unhandled exception [${requestId}]: ${String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(statusCode).json({
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      traceId: requestId,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
