/**
 * Wraps an async Express handler so errors propagate to `next()` and can be
 * handled by centralized error middleware.
 */
export function asyncHandler(fn) {
  return function asyncHandlerWrapper(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

