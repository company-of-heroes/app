import { toast } from '@company-of-heroes/ui/toasts';

/** Off until the live Mollie profile has a recurring-capable payment method (iDEAL + SEPA, card). */
export const SUPPORTER_CHECKOUT_OPEN = false;

/** True (after a "coming soon" toast) while the checkout is closed. */
export function supporterCheckoutClosed(t: (key: string) => string): boolean {
	if (SUPPORTER_CHECKOUT_OPEN) {
		return false;
	}

	toast.info(t('Becoming a supporter is coming soon. Check back in a few days.'));
	return true;
}
