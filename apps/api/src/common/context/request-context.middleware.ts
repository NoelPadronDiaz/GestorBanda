import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import {
  RequestContextService,
  type RequestContext,
  type RequestWithContext,
} from './request-context.service';

const TRACE_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContext: RequestContextService) {}

  use(req: RequestWithContext, res: Response, next: NextFunction): void {
    const incoming = req.header('x-trace-id');
    const traceId = incoming && TRACE_ID_PATTERN.test(incoming) ? incoming : randomUUID();
    const context: RequestContext = {
      traceId,
      ipAddress: req.ip ?? null,
      userAgent: req.header('user-agent')?.slice(0, 512) ?? null,
      userId: null,
    };
    req.ctx = context;
    res.setHeader('x-trace-id', traceId);
    this.requestContext.run(context, () => next());
  }
}
