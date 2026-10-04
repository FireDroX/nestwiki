import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter.js';

const JSON_RPC_AUTH_ERROR_CODE = -32001;

@Catch()
export class McpExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception.name === 'InvalidApiKeyException') {
      response.status(HttpStatus.UNAUTHORIZED).json({
        jsonrpc: '2.0',
        error: { code: JSON_RPC_AUTH_ERROR_CODE, message: exception.message },
        id: null,
      });
      return;
    }

    const resolved = McpExceptionFilter.resolve(exception);
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
      case 'McpApiKeyNotFoundException':
        return { statusCode: HttpStatus.NOT_FOUND, error: exception.message };
      case 'ValidationException':
      case 'OAuthInvalidRequestException':
        return { statusCode: HttpStatus.BAD_REQUEST, error: exception.message };
      case 'OAuthInvalidClientException':
      case 'OAuthRefreshTokenNotFoundException':
        return { statusCode: HttpStatus.NOT_FOUND, error: exception.message };
      case 'OAuthAccessDeniedException':
        return { statusCode: HttpStatus.FORBIDDEN, error: exception.message };
      default:
        return null;
    }
  }
}
