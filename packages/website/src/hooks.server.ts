import { dev } from '$app/environment';

export { handle } from '$lib/hooks/handle';
export { handleError } from '$lib/hooks/error';

// Dev only: a rejected promise nobody awaited (often a SvelteKit error()/redirect(),
// which Node prints as "[object Object]") is logged in full instead of killing vite.
const devGlobal = globalThis as { __cohUnhandledRejectionLogger?: boolean };
if (dev && typeof process !== 'undefined' && !devGlobal.__cohUnhandledRejectionLogger) {
	devGlobal.__cohUnhandledRejectionLogger = true;
	process.on('unhandledRejection', (reason) => {
		console.error('[unhandledRejection]', reason);
	});
}
