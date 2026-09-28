import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { AccountLockedException } from '../../common/exceptions/auth/account-locked.exception.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';

@Catch()
export class AuthExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof AccountLockedException) {
      const retryAfterSeconds = Math.max(
        0,
        Math.ceil((exception.lockedUntil.getTime() - Date.now()) / 1000),
      );
      response.setHeader('Retry-After', String(retryAfterSeconds));
      const body: ErrorResponseDto = { error: exception.message };
      response.status(HttpStatus.LOCKED).json(body);
      return;
    }

    const { statusCode, error } = AuthExceptionFilter.resolve(exception);
    const body: ErrorResponseDto = { error };
    response.status(statusCode).json(body);
  }

  private static resolve(exception: Error): {
    statusCode: number;
    error: string;
  } {
    switch (exception.name) {
      case 'EmailAlreadyExistsException':
        return { statusCode: HttpStatus.CONFLICT, error: exception.message };
      case 'ValidationException':
        return { statusCode: HttpStatus.BAD_REQUEST, error: exception.message };
      case 'InvalidCredentialsException':
        return {
          statusCode: HttpStatus.UNAUTHORIZED,
          error: exception.message,
        };
      case 'InvalidRefreshTokenException':
      case 'AccountDisabledException':
        return {
          statusCode: HttpStatus.UNAUTHORIZED,
          error: exception.message,
        };
      case 'InvalidTurnstileTokenException':
        return { statusCode: HttpStatus.BAD_REQUEST, error: exception.message };
      case 'WeakPasswordException':
        return { statusCode: HttpStatus.BAD_REQUEST, error: exception.message };
      case 'CompromisedPasswordException':
        return { statusCode: HttpStatus.BAD_REQUEST, error: exception.message };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: exception.message || 'Internal server error',
        };
    }
  }
}
