import type { ParamMatcher } from '@sveltejs/kit';
import { STEAM_ID_REGEX } from '$lib/steam-id';

export const match: ParamMatcher = (param) => STEAM_ID_REGEX.test(param);
