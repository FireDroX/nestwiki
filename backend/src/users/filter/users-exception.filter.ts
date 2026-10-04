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
export class UsersExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    const resolved = UsersExceptionFilter.resolve(exception);
    if (!resolved) {
      HttpExceptionFilter.respond(exception, response);
      return;
    }
    const body: ErrorResponseDto = { error: resolved.error };
    response.status(resolved.statusCode).json(body);
  }

  private static resolve(
    exception: Error,
  ): { statusCode: number; error: string } | null {
    switch (exception.name) {
      case 'UserNotFoundException':
      case 'AccessRuleNotFoundException':
      case 'PageNotFoundException':
      case 'GroupNotFoundException':
      case 'AvatarNotFoundException':
        return { statusCode: HttpStatus.NOT_FOUND, error: exception.message };
      case 'EmailAlreadyExistsException':
      case 'LastActiveAdminException':
      case 'SelfActionNotAllowedException':
        return { statusCode: HttpStatus.CONFLICT, error: exception.message };
      case 'InsufficientPermissionException':
        return { statusCode: HttpStatus.FORBIDDEN, error: exception.message };
      case 'ValidationException':
        return { statusCode: HttpStatus.BAD_REQUEST, error: exception.message };
      default:
        return null;
    }
  }
}
