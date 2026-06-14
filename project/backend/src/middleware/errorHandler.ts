import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { errorResponse } from '../utils/response';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  logger.error(`Error: ${err.message}`, {
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  if (err.name === 'ValidationError') {
    errorResponse(res, err.message, 400);
    return;
  }

  if (err.name === 'UnauthorizedError') {
    errorResponse(res, 'Unauthorized', 401);
    return;
  }

  errorResponse(res, 'Internal server error', 500);
}
