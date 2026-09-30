import { appError, type AppError } from '$lib/errors/app-error';

export type { AppError };

export const badRequest = (message = 'Bad request'): AppError => appError(400, message);

export const unauthorized = (message = 'Unauthorized'): AppError => appError(401, message);

export const forbidden = (message = 'Forbidden'): AppError => appError(403, message);

export const notFound = (message = 'Not found'): AppError => appError(404, message);

export const conflict = (message = 'Conflict'): AppError => appError(409, message);

export const rateLimited = (message: string, retryAfter?: number): AppError =>
	appError(429, message, { retryAfter });

export const upstream = (message = 'Upstream request failed'): AppError => appError(502, message);

export const internal = (message = 'Something went wrong. Please try again later.'): AppError =>
	appError(500, message);
