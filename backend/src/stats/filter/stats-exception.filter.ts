import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter.js';

@Catch()
export class StatsExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    HttpExceptionFilter.respond(
      exception,
      host.switchToHttp().getResponse<Response>(),
    );
  }
}
