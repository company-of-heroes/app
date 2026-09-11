import type { ParamMatcher } from '@sveltejs/kit';
import { STEAM_ID_REGEX } from '$lib/utils/player/steam-id';

export const match: ParamMatcher = (param) => STEAM_ID_REGEX.test(param);
