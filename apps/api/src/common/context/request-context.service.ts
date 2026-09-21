import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

export interface RequestContext {
  traceId: string;
  ipAddress: string | null;
  userAgent: string | null;
  userId: string | null;
}

export type RequestWithContext = Request & { ctx?: RequestContext };

/** Contexto por petición (quién, desde dónde, trace_id) disponible sin pasar `req` por todas las capas. */
@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  run<T>(context: RequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  get(): RequestContext | undefined {
    return this.storage.getStore();
  }

  get traceId(): string | null {
    return this.get()?.traceId ?? null;
  }
}
