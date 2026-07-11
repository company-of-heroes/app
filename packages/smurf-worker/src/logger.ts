type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
	const entry = {
		level,
		message,
		ts: new Date().toISOString(),
		...data
	};

	const line = JSON.stringify(entry);

	switch (level) {
		case 'error':
			console.error(line);
			break;
		case 'warn':
			console.warn(line);
			break;
		default:
			console.log(line);
	}
}

export function logError(message: string, error: unknown, data?: Record<string, unknown>): void {
	log('error', message, {
		...data,
		error: error instanceof Error ? error.message : String(error),
		stack: error instanceof Error ? error.stack : undefined
	});
}
