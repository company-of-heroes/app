import { err, ok, type Result } from 'neverthrow';
import type { z } from 'zod';
import { badRequest, type AppError } from './errors';

/** Validates input with a zod schema; the first issue becomes a 400. */
export function parse<T extends z.ZodType>(
	schema: T,
	input: unknown
): Result<z.infer<T>, AppError> {
	const result = schema.safeParse(input);
	if (!result.success) {
		return err(badRequest(result.error.issues[0]?.message ?? 'Invalid input'));
	}

	return ok(result.data);
}
