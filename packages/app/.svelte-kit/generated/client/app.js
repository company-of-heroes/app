export { matchers } from './matchers.js';

export const nodes = [
	() => import('./nodes/0'),
	() => import('./nodes/1'),
	() => import('./nodes/2'),
	() => import('./nodes/3'),
	() => import('./nodes/4'),
	() => import('./nodes/5'),
	() => import('./nodes/6'),
	() => import('./nodes/7'),
	() => import('./nodes/8'),
	() => import('./nodes/9'),
	() => import('./nodes/10'),
	() => import('./nodes/11'),
	() => import('./nodes/12'),
	() => import('./nodes/13'),
	() => import('./nodes/14'),
	() => import('./nodes/15'),
	() => import('./nodes/16'),
	() => import('./nodes/17'),
	() => import('./nodes/18'),
	() => import('./nodes/19')
];

export const server_loads = [];

export const dictionary = {
		"/(loaded)": [4,[2]],
		"/(loaded)/account": [5,[2]],
		"/(loaded)/admin": [6,[2]],
		"/(loaded)/admin/notifications": [7,[2]],
		"/(loaded)/current-game": [8,[2]],
		"/(loaded)/history": [9,[2]],
		"/(loaded)/history/[id]": [10,[2]],
		"/(loaded)/leaderboards": [11,[2]],
		"/(loaded)/leaderboards/profile/[profileId]": [12,[2]],
		"/(loaded)/replays": [13,[2]],
		"/(loaded)/replays/[replayId]": [14,[2]],
		"/(loaded)/settings": [15,[2]],
		"/(onboarding)/setup": [19],
		"/(loaded)/shortcuts": [16,[2]],
		"/(loading)/splashscreen": [18,[3]],
		"/(loaded)/twitch": [17,[2]]
	};

export const hooks = {
	handleError: (({ error }) => { console.error(error) }),
	
	reroute: (() => {}),
	transport: {}
};

export const decoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.decode]));
export const encoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.encode]));

export const hash = false;

export const decode = (type, value) => decoders[type](value);

export { default as root } from '../root.js';