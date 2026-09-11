import type { HandleServerError } from '@sveltejs/kit';

export const handleError: HandleServerError = ({ error, message, event }) => {
	console.error(error);
	const fallback = 'Something went wrong. Please try again later.';
	return {
		message:
			message === 'Internal Error' ? (event.locals.t?.(fallback) ?? fallback) : message
	};
};
