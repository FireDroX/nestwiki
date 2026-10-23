import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter.js';

@Catch()
export class ImportsExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    const resolved = ImportsExceptionFilter.resolve(exception);
    if (!resolved) {
      HttpExceptionFilter.respond(exception, response);
      return;
    }
    const body: ErrorResponseDto = { error: resolved.error };
    response.status(resolved.statusCode).json(body);
  }

  static resolve(
    exception: Error,
  ): { statusCode: number; error: string } | null {
    switch (exception.name) {
      case 'PageNotFoundException':
      case 'UserNotFoundException':
        return { statusCode: HttpStatus.NOT_FOUND, error: exception.message };
      case 'PageAccessForbiddenException':
      case 'InsufficientPagePermissionException':
        return { statusCode: HttpStatus.FORBIDDEN, error: exception.message };
      case 'ImportTooLargeException':
        return {
          statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
          error: exception.message,
        };
      case 'ValidationException':
      case 'UnsupportedImportFileException':
      case 'InvalidImportArchiveException':
      case 'UnsafeImportPathException':
        return { statusCode: HttpStatus.BAD_REQUEST, error: exception.message };
      default:
        return null;
    }
  }
}
