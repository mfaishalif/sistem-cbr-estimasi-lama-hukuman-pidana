import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ValidationError } from '@cbr/data';

/** Turn domain validation messages into a stable 400 response shape. */
@Catch(ValidationError)
export class ValidationErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ValidationErrorFilter.name);

  catch(exception: ValidationError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    this.logger.warn(`Validasi ditolak: ${exception.message}`);
    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'Validasi',
      message: exception.message,
    });
  }
}
