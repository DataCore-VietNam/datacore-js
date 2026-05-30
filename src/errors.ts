export class DataCoreError extends Error {
  public readonly status?: number;
  constructor(message: string, status?: number) {
    super(message); this.name = 'DataCoreError'; this.status = status;
    const e = Error as unknown as { captureStackTrace?: (t: object, c: new (...a: never[]) => unknown) => void };
    if (typeof e.captureStackTrace === 'function') e.captureStackTrace(this, this.constructor as new (...a: never[]) => unknown);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
export class AuthenticationError extends DataCoreError { constructor(m = 'Authentication failed') { super(m, 401); this.name = 'AuthenticationError'; } }
export class NotFoundError extends DataCoreError { constructor(m = 'Resource not found') { super(m, 404); this.name = 'NotFoundError'; } }
export class RateLimitError extends DataCoreError { public readonly retryAfter?: number; constructor(m = 'Rate limit exceeded', retryAfter?: number) { super(m, 429); this.name = 'RateLimitError'; this.retryAfter = retryAfter; } }
export class ValidationError extends DataCoreError { constructor(m = 'Validation error', status = 400) { super(m, status); this.name = 'ValidationError'; } }
export class ServerError extends DataCoreError { constructor(m = 'Server error', status = 500) { super(m, status); this.name = 'ServerError'; } }
