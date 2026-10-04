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
export class PagesExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    const resolved = PagesExceptionFilter.resolve(exception);
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
      case 'ReservedSlugException':
        return { statusCode: HttpStatus.BAD_REQUEST, error: exception.message };
      default:
        return null;
    }
  }
}
