declare module 'firebase-functions/v2/https' {
  export type FunctionsErrorCode =
    | 'ok'
    | 'cancelled'
    | 'unknown'
    | 'invalid-argument'
    | 'deadline-exceeded'
    | 'not-found'
    | 'already-exists'
    | 'permission-denied'
    | 'resource-exhausted'
    | 'failed-precondition'
    | 'aborted'
    | 'out-of-range'
    | 'unimplemented'
    | 'internal'
    | 'unavailable'
    | 'data-loss'
    | 'unauthenticated';

  export class HttpsError extends Error {
    readonly code: FunctionsErrorCode;
    readonly details?: unknown;
    constructor(code: FunctionsErrorCode, message: string, details?: unknown);
  }

  export interface CallableRequest<T = unknown> {
    data: T;
    auth?: {
      uid: string;
      token: Record<string, unknown>;
    };
    rawRequest: {
      ip?: string;
      headers: Record<string, string | string[] | undefined>;
    };
  }

  export interface CallableOptions {
    region?: string;
    enforceAppCheck?: boolean;
    cors?: boolean | string[];
  }

  export function onCall<T = unknown, R = unknown>(
    options: CallableOptions,
    handler: (request: CallableRequest<T>) => Promise<R> | R
  ): (request: CallableRequest<T>) => Promise<R>;
}
