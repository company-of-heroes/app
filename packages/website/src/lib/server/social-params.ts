import { z } from 'zod';
import type { Result } from 'neverthrow';
import type { AppError } from './errors';
import { parse } from './validate';
import type { TargetKind } from './services/social';

/** `toggle`: the same vote again removes it (what a click on the button means). */
export const voteBody = z.object({
	value: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
	toggle: z.boolean().optional()
});

/** Route segment `lobby` (community match) or `replay` (member replay). */
export function targetKind(value: string | undefined): Result<TargetKind, AppError> {
	return parse(z.enum(['lobby', 'replay']), value);
}
