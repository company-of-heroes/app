import { toast } from '@company-of-heroes/ui/toasts';

/** Set to false to close the checkout (e.g. when the live Mollie profile loses its recurring-capable payment methods). */
export const SUPPORTER_CHECKOUT_OPEN = true;

/** True (after a "coming soon" toast) while the checkout is closed. */
export function supporterCheckoutClosed(t: (key: string) => string): boolean {
	if (SUPPORTER_CHECKOUT_OPEN) {
		return false;
	}

	toast.info(t('Becoming a supporter is coming soon. Check back in a few days.'));
	return true;
}
