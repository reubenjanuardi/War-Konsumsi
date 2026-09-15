import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Terjadi kesalahan pada sistem. Silakan coba lagi.';
    let code = 'INTERNAL_SERVER_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, any>;
        message = obj.message || message;
        code = obj.code || code;
        if (Array.isArray(message)) {
          message = message[0];
        }
      }
    } else {
      this.logger.error('Unhandled internal exception:', exception);
    }

    response.status(status).json({
      success: false,
      code,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
