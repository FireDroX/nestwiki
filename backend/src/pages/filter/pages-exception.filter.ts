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
export class PagesExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (
      exception instanceof UnauthorizedException ||
      exception instanceof ForbiddenException
    ) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    const { statusCode, error } = PagesExceptionFilter.resolve(exception);
    const body: ErrorResponseDto = { error };
    response.status(statusCode).json(body);
  }

  private static resolve(exception: Error): {
    statusCode: number;
    error: string;
  } {
    switch (exception.name) {
      case 'ParentPageNotFoundException':
      case 'PageNotFoundException':
      case 'VersionNotFoundException':
      case 'UserNotFoundException':
      case 'CommentNotFoundException':
      case 'TagNotFoundException':
      case 'PageTagNotFoundException':
      case 'GroupNotFoundException':
      case 'AccessRuleNotFoundException':
        return { statusCode: HttpStatus.NOT_FOUND, error: exception.message };
      case 'SlugAlreadyExistsException':
      case 'CircularReferenceException':
      case 'PageHasChildrenException':
      case 'PageTagAlreadyExistsException':
        return { statusCode: HttpStatus.CONFLICT, error: exception.message };
      case 'PageAccessForbiddenException':
      case 'InsufficientPagePermissionException':
      case 'InsufficientPermissionException':
      case 'CommentsDisabledException':
        return { statusCode: HttpStatus.FORBIDDEN, error: exception.message };
      case 'ValidationException':
      case 'ReplyNestingException':
        return { statusCode: HttpStatus.BAD_REQUEST, error: exception.message };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: exception.message || 'Internal server error',
        };
    }
  }
}
