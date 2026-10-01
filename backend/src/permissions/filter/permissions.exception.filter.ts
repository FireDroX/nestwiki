import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';

@Catch()
export class PermissionsExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (
      exception instanceof UnauthorizedException ||
      exception instanceof ForbiddenException
    ) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    const { statusCode, error } = PermissionsExceptionFilter.resolve(exception);
    const body: ErrorResponseDto = { error };
    response.status(statusCode).json(body);
  }

  private static resolve(exception: Error): {
    statusCode: number;
    error: string;
  } {
    switch (exception.name) {
      case 'GroupNotFoundException':
      case 'AccessRuleNotFoundException':
      case 'UserNotFoundException':
      case 'PageNotFoundException':
        return { statusCode: HttpStatus.NOT_FOUND, error: exception.message };
      case 'GroupNameAlreadyExistsException':
        return { statusCode: HttpStatus.CONFLICT, error: exception.message };
      case 'InsufficientPermissionException':
        return { statusCode: HttpStatus.FORBIDDEN, error: exception.message };
      case 'ValidationException':
        return { statusCode: HttpStatus.BAD_REQUEST, error: exception.message };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: exception.message || 'Internal server error',
        };
    }
  }
}
