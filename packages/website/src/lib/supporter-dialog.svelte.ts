/**
 * Shared state of the supporter dialog (header button and mobile menu entry): whether it is open,
 * and the status fetched when it opened (it wins over the cached label once known).
 */
export const supporterDialog = $state<{
	open: boolean;
	active: boolean | null;
	endsAt: string | null;
}>({
	open: false,
	active: null,
	endsAt: null
});
