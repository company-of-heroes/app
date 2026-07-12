type LogLevel = 'debug' | 'info' | 'warn' | 'error';

let currentRunId: string | null = null;

export function createRunContext(): string {
	currentRunId = crypto.randomUUID();
	return currentRunId;
}

export function getRunId(): string | null {
	return currentRunId;
}

export function clearRunContext(): void {
	currentRunId = null;
}

export function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
	const entry = {
		level,
		message,
		ts: new Date().toISOString(),
		...(currentRunId ? { runId: currentRunId } : {}),
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
