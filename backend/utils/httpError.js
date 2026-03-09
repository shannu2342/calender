export class HttpError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   * @param {{ code?: string, details?: any, cause?: any }} [options]
   */
  constructor(statusCode, message, options = {}) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = options.code;
    this.details = options.details;
    this.cause = options.cause;
  }
}

export function isHttpError(err) {
  return Boolean(err && typeof err === "object" && "statusCode" in err);
}

