import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter.js';

interface OAuthErrorBody {
  error: string;
  error_description: string;
}

@Catch()
export class OAuthExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { statusCode, body } = OAuthExceptionFilter.resolve(exception);
    response.status(statusCode).json(body);
  }

  private static resolve(exception: Error): {
    statusCode: number;
    body: OAuthErrorBody;
  } {
    switch (exception.name) {
      case 'OAuthInvalidRequestException':
      case 'ValidationException':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          body: {
            error: 'invalid_request',
            error_description: exception.message,
          },
        };
      case 'OAuthInvalidClientException':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          body: {
            error: 'invalid_client',
            error_description: exception.message,
          },
        };
      case 'OAuthInvalidGrantException':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          body: {
            error: 'invalid_grant',
            error_description: exception.message,
          },
        };
      case 'OAuthAccessDeniedException':
        return {
          statusCode: HttpStatus.FORBIDDEN,
          body: {
            error: 'access_denied',
            error_description: exception.message,
          },
        };
      case 'OAuthUnsupportedGrantTypeException':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          body: {
            error: 'unsupported_grant_type',
            error_description: exception.message,
          },
        };
      default:
        return OAuthExceptionFilter.fromHttpStatus(
          HttpExceptionFilter.statusOf(exception),
          exception.message || 'Internal server error',
        );
    }
  }

  private static fromHttpStatus(
    statusCode: number,
    description: string,
  ): { statusCode: number; body: OAuthErrorBody } {
    return {
      statusCode,
      body: {
        error: OAuthExceptionFilter.errorCodeFor(statusCode),
        error_description: description,
      },
    };
  }

  private static errorCodeFor(statusCode: number): string {
    if (statusCode === Number(HttpStatus.TOO_MANY_REQUESTS)) {
      return 'temporarily_unavailable';
    }
    if (statusCode >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      return 'server_error';
    }
    return 'invalid_request';
  }
}
