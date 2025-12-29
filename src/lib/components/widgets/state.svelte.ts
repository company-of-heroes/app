import type { Lobby } from '$core/company-of-heroes';

export class WidgetState {
	match: Lobby | null = $state(null);
}

export const state = new WidgetState();
