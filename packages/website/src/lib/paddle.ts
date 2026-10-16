const PADDLE_SCRIPT = 'https://cdn.paddle.com/paddle/v2/paddle.js';

/** What `POST /api/v1/subscriptions/checkout` returns. */
export type PaddleCheckout = {
	priceId: string;
	clientToken: string;
	environment: 'sandbox' | 'production';
	customData: { userId: string };
	email: string | null;
};

type PaddleGlobal = {
	Environment: { set: (environment: 'sandbox' | 'production') => void };
	Initialize: (options: { token: string }) => void;
	Checkout: { open: (options: Record<string, unknown>) => void };
};

declare global {
	interface Window {
		Paddle?: PaddleGlobal;
	}
}

let loading: Promise<PaddleGlobal> | null = null;
let initialized = false;

/** Loads Paddle.js once, only when a checkout is about to open. */
function loadPaddle(): Promise<PaddleGlobal> {
	if (window.Paddle) {
		return Promise.resolve(window.Paddle);
	}

	loading ??= new Promise<PaddleGlobal>((resolve, reject) => {
		const script = document.createElement('script');
		script.src = PADDLE_SCRIPT;
		script.async = true;
		script.onload = () => {
			if (window.Paddle) {
				resolve(window.Paddle);
				return;
			}

			loading = null;
			reject(new Error('Paddle did not load'));
		};
		script.onerror = () => {
			loading = null;
			script.remove();
			reject(new Error('Paddle did not load'));
		};
		document.head.append(script);
	});

	return loading;
}

/** Opens the Paddle checkout overlay; `successUrl` must be absolute. */
export async function openCheckout(data: PaddleCheckout, successUrl: string): Promise<void> {
	const paddle = await loadPaddle();
	if (!initialized) {
		if (data.environment === 'sandbox') {
			paddle.Environment.set('sandbox');
		}

		paddle.Initialize({ token: data.clientToken });
		initialized = true;
	}

	paddle.Checkout.open({
		items: [{ priceId: data.priceId, quantity: 1 }],
		customData: data.customData,
		customer: data.email ? { email: data.email } : undefined,
		settings: { successUrl }
	});
}
