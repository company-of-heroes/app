export type {
	SupporterEntry,
	SupporterStatus,
	SupportersList
} from '@company-of-heroes/ui/supporter/types';

/** Where the browser goes to pay the first month (Mollie's hosted checkout). */
export type SupporterCheckout = { checkoutUrl: string };
