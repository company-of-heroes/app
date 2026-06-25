/** Test double for @tauri-apps/api/core */

type InvokeHandler = (command: string, args?: Record<string, unknown>) => unknown;

let handler: InvokeHandler = () => undefined;

export const __invoke = {
	setHandler(next: InvokeHandler) {
		handler = next;
	},
	reset() {
		handler = () => undefined;
	}
};

export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
	return handler(command, args) as T;
}
