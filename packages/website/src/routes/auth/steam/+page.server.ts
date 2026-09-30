import { redeemLoginCode } from '$lib/server/handoff-page';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = (event) => redeemLoginCode(event);
