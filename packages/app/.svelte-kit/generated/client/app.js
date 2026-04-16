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
	() => import('./nodes/16')
];

export const server_loads = [];

export const dictionary = {
		"/(loaded)": [3,[2]],
		"/(loaded)/account": [4,[2]],
		"/(loaded)/chat": [5,[2]],
		"/(loaded)/current-game": [6,[2]],
		"/(loaded)/history": [7,[2]],
		"/(loaded)/history/[id]": [8,[2]],
		"/(loaded)/leaderboards": [9,[2]],
		"/(loaded)/leaderboards/profile/[profileId]": [10,[2]],
		"/(loaded)/replays": [11,[2]],
		"/(loaded)/replays/[replayId]": [12,[2]],
		"/(loaded)/settings": [13,[2]],
		"/(loaded)/shortcuts": [14,[2]],
		"/(loading)/splashscreen": [16],
		"/(loaded)/twitch": [15,[2]]
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