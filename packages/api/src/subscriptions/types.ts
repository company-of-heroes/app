export type {
	SupporterEntry,
	SupporterStatus,
	SupportersList
} from '@company-of-heroes/ui/supporter/types';

/** What Paddle.js needs to open the checkout. */
export type SupporterCheckout = {
	priceId: string;
	clientToken: string;
	environment: 'sandbox' | 'production';
	customData: { userId: string };
	email: string | null;
};
