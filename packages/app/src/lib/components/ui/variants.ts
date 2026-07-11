export type SemanticVariant = 'default' | 'destructive' | 'warning' | 'success' | 'info';

export const controlBase =
	'border-secondary-800 bg-secondary-800/30 focus:border-secondary-600 h-11 rounded-md border focus:outline-none';

export const adornedControl =
	'border-secondary-800 bg-secondary-800/30 focus-within:border-secondary-600 flex h-11 w-full items-stretch overflow-hidden rounded-md border focus-within:outline-none';

export const adornedInput =
	'placeholder:text-secondary-500 min-w-0 flex-1 border-0 bg-transparent px-3 py-0 focus:outline-none focus:ring-0';

export const adornedLeading =
	'text-secondary-500 border-secondary-800 flex shrink-0 items-center border-r px-3';

export const adornedTrailing =
	'text-secondary-500 border-secondary-800 flex shrink-0 items-center border-l px-3';

export const adornedActions = 'border-secondary-800 flex shrink-0 items-center border-l px-1.5';

export const adornedControlDisabled =
	'has-[:disabled]:cursor-not-allowed has-[:disabled]:border-secondary-800 has-[:disabled]:bg-secondary-800/30 has-[:disabled]:text-secondary-500';

export const controlDisabled =
	'disabled:cursor-not-allowed disabled:border-secondary-800 disabled:bg-secondary-800/30 disabled:text-secondary-500';

export const controlReadonly =
	'read-only:cursor-default read-only:border-secondary-800 read-only:bg-secondary-800/30 read-only:text-secondary-400 read-only:focus:border-secondary-800';

export const labelText = 'font-medium text-secondary-400';

export const surfacePanel = 'bg-secondary-950/90 border-secondary-800 rounded-md border';

export const overlayBackdrop = 'bg-gray-950/80 backdrop-blur-md';

export const surfaceModal = surfacePanel;

export const menuItem =
	'cursor-pointer rounded px-4 py-2 text-secondary-200 transition-colors hover:bg-secondary-800 hover:text-white';

export const interactive = 'cursor-pointer disabled:cursor-not-allowed';

export const statWins = 'text-green-100 tabular-nums';
export const statLosses = 'text-red-100 tabular-nums';
export const statStreakPositive = 'text-green-300 tabular-nums';
export const statStreakNegative = 'text-red-300 tabular-nums';
export const statStreakNeutral = 'text-secondary-400 tabular-nums';

export function statStreakClass(streak: number): string {
	if (streak > 0) return statStreakPositive;
	if (streak < 0) return statStreakNegative;
	return statStreakNeutral;
}

export function formatStreak(streak: number): string {
	if (streak > 0) return `+${streak}`;
	return String(streak);
}

export const stepperButton =
	'border-secondary-700 bg-secondary-800/80 text-secondary-300 hover:border-secondary-600 hover:bg-secondary-700 hover:text-white active:bg-secondary-600 flex size-6 cursor-pointer items-center justify-center rounded border transition-colors disabled:cursor-not-allowed';

const semanticVariantClasses: Record<SemanticVariant, string> = {
	default: 'border-secondary-600 bg-secondary-800/10 text-secondary-200',
	destructive: 'border-destructive/25 bg-destructive/5 text-destructive/80',
	warning: 'border-warning bg-warning/10 text-warning',
	success: 'border-success bg-success/10 text-success',
	info: 'border-info bg-info/10 text-info'
};

export function semanticVariant(variant: SemanticVariant = 'default') {
	return semanticVariantClasses[variant];
}

const toastVariantClasses: Record<'success' | 'error' | 'info', string> = {
	success:
		'gap-2 flex items-center bg-success/10 border-success text-success border rounded-md px-3 py-1.5 shadow-xl text-sm',
	error:
		'gap-2 flex items-center bg-destructive/5 border-destructive/30 text-destructive/80 border rounded-md px-3 py-1.5 shadow-xl text-sm',
	info: 'gap-2 flex items-center bg-secondary-900 border-secondary-600 text-white border rounded-md px-3 py-1.5 shadow-xl text-sm'
};

export function toastVariant(variant: 'success' | 'error' | 'info') {
	return toastVariantClasses[variant];
}
