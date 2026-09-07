import { cn } from './cn';

export type SemanticVariant = 'default' | 'destructive' | 'warning' | 'success' | 'info';

/** Circular faction flag — size-5 icon with ring-4. Use everywhere team/player flags appear. */
export const factionIcon = cn(
	'!size-5 shrink-0 rounded-full object-cover',
	'ring-secondary-800 ring-4'
);

export const controlBase =
	'border-secondary-800 bg-secondary-800/30 placeholder:text-secondary-500 focus:border-secondary-600 h-9 rounded-md border text-base font-medium text-white focus:outline-none';

export const fileDropzone =
	'border-secondary-800 bg-secondary-800/30 focus-visible:border-secondary-600 flex h-auto min-h-24 w-full flex-col items-center justify-center gap-1 rounded-md border px-4 py-4 text-center text-base font-medium text-white transition-colors focus-visible:outline-none';

export const fileDropzoneDragging = 'border-secondary-600 bg-secondary-800/50';

export const adornedControl =
	'border-secondary-800 bg-secondary-800/30 focus-within:border-secondary-600 flex h-9 w-full items-stretch overflow-hidden rounded-md border focus-within:outline-none';

export const adornedInput =
	'placeholder:text-secondary-500 min-w-0 flex-1 border-0 bg-transparent px-3 py-0 text-base font-medium text-white focus:outline-none focus:ring-0';

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

export const flushInput =
	'placeholder:text-secondary-500 min-w-40 flex-1 bg-transparent text-base font-medium text-white outline-none disabled:cursor-not-allowed disabled:text-secondary-500';

export const flushTextarea =
	'placeholder:text-secondary-500 w-full resize-y bg-transparent text-base font-medium text-white outline-none disabled:cursor-not-allowed disabled:text-secondary-500';

export const flushSelect = `${flushInput} group flex min-w-0 cursor-pointer items-center justify-between truncate text-left`;

export const flushBand = 'border-secondary-800 bg-secondary-800/30 border-b';

export const flushField = 'flex flex-wrap items-center gap-3 px-4 py-3';

export const flushFooter = 'border-secondary-800 flex items-stretch border-t';

export const flushHeader = 'border-secondary-800 border-b px-4 py-3';

export const flushHeaderTitle = 'text-secondary-300 text-xs font-semibold tracking-wide uppercase';

export const flushSectionTitle = 'text-secondary-200 text-sm font-bold tracking-wider uppercase';

export const flushHeaderDescription = 'text-secondary-400 mt-1 text-sm';

export const footerAction =
	'hover:bg-primary/10 h-auto min-h-9 shrink-0 rounded-none border-y-0 border-l-0 border-r border-secondary-800 px-3';

export const labelText = 'font-medium text-secondary-400';

export const surfacePanel = 'bg-secondary-950/90 border-secondary-800 rounded-md border';

export const surfaceOverlay = 'overlay-surface bg-gray-950 border-secondary-800 rounded-md border';

export const overlayBackdrop = 'bg-gray-950/80 backdrop-blur-md';

export const surfaceModal = surfaceOverlay;

export const dropdownPanel =
	'border-secondary-800 bg-gray-950 overflow-hidden rounded-none border p-0 shadow-none';

export const dropdownHeader =
	'border-secondary-800 flex items-center justify-between border-b px-4 py-3';

export const dropdownSubheader = 'border-secondary-800 border-b px-4 py-3';

export const dropdownItem =
	'cursor-pointer rounded-none border-secondary-800 border-b px-4 py-2.5 text-sm text-secondary-200 transition-colors last:border-b-0 hover:bg-secondary-800/40 hover:text-white data-highlighted:bg-secondary-800/40 data-highlighted:text-white';

export const dropdownItemIcon = 'flex items-center gap-3 text-white';

export const menuItem = dropdownItem;

export const interactive = 'cursor-pointer disabled:cursor-not-allowed';

export const tableHeadText =
	'font-sans text-xs font-semibold tracking-wide text-secondary-300 uppercase';

export const tableHeadRow = `bg-secondary-950/90 border-secondary-800 border-b ${tableHeadText}`;

export const tableSortHeader = `${interactive} ${tableHeadText} flex w-full min-w-0 items-center bg-transparent p-0 select-none`;

export const tabTrigger =
	`${interactive} text-white rounded-md border border-transparent px-4 py-1.5 font-bold transition-colors duration-150 ` +
	'not-disabled:hover:bg-secondary-950/50 ' +
	'not-disabled:data-[state=active]:border-primary/20 not-disabled:data-[state=active]:bg-primary/5 not-disabled:data-[state=active]:text-primary ' +
	'disabled:text-secondary-500';

export const mePlayerText = 'text-primary font-semibold';

export const detailMetaGrid =
	'grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr_auto_1fr] sm:gap-x-6';

export const statWins = 'text-green-100 tabular-nums';
export const statLosses = 'text-red-100 tabular-nums';
export const statStreakPositive = 'text-green-300 tabular-nums';
export const statStreakNegative = 'text-red-300 tabular-nums';
export const statStreakNeutral = 'text-secondary-400 tabular-nums';

export function statStreakClass(streak: number): string {
	if (streak > 0) {
		return statStreakPositive;
	}

	if (streak < 0) {
		return statStreakNegative;
	}

	return statStreakNeutral;
}

export function formatStreak(streak: number): string {
	if (streak > 0) {
		return `+${streak}`;
	}

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

/** Shared toast chrome — pairs with Sonner `classes.toast` when unstyled. */
export const toastBase =
	'relative flex w-[min(22rem,calc(100vw-2rem))] items-center gap-2.5 rounded-md border border-secondary-800 bg-secondary-950 px-3 py-2.5 text-sm text-secondary-100 shadow-md';
