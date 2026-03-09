import { isHttpError } from "../utils/httpError.js";

/**
 * Centralized JSON error handler.
 * Keeps responses consistent and avoids leaking sensitive server details in production.
 */
export function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-unused-vars
  const _next = next;

  const statusCode = isHttpError(err) ? err.statusCode : 500;

  const payload = {
    error: statusCode === 500 ? "Internal Server Error" : err.message,
  };

  if (isHttpError(err) && err.code) payload.code = err.code;

  // Only include details in non-production environments.
  if (process.env.NODE_ENV !== "production") {
    if (isHttpError(err) && err.details != null) payload.details = err.details;
    if (!isHttpError(err)) payload.details = { message: err?.message };
  }

  res.status(statusCode).json(payload);
}

