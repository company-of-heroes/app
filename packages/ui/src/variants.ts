import { cn } from './cn';

export type SemanticVariant = 'default' | 'destructive' | 'warning' | 'success' | 'info';

/** Circular faction flag — size-5 icon with ring-4. Use everywhere team/player flags appear. */
export const factionIcon = cn(
	'!size-5 shrink-0 rounded-full object-cover',
	'ring-secondary-800 ring-4'
);

export const controlBase =
	'border-secondary-700 bg-secondary-950 placeholder:text-secondary-500 focus:border-secondary-600 h-8 rounded-md border text-base font-medium text-white focus:outline-none';

export const fileDropzone = cn(
	'flex h-auto min-h-24 w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed px-4 py-4',
	'text-center text-base font-medium text-white transition-colors',
	'border-secondary-700 bg-secondary-950',
	'hover:border-secondary-500 hover:bg-secondary-900/60',
	'focus-visible:border-secondary-500 focus-visible:outline-none'
);

export const fileDropzoneDragging = 'border-primary bg-primary/10';

/** Native `<input type="file">` styled as a dark dashed field. */
export const fileInput = cn(
	'w-full cursor-pointer rounded-md border border-dashed p-1.5 text-sm transition-colors',
	'border-secondary-700 bg-secondary-950 text-secondary-400',
	'hover:border-secondary-500 hover:bg-secondary-900/60',
	'focus-visible:border-secondary-500 focus-visible:outline-none',
	'file:bg-secondary-800 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white',
	'hover:file:bg-secondary-700'
);

export const adornedControl =
	'border-secondary-700 bg-secondary-950 focus-within:border-secondary-600 flex h-8 w-full items-stretch overflow-hidden rounded-md border focus-within:outline-none';

export const adornedInput =
	'placeholder:text-secondary-500 min-w-0 flex-1 border-0 bg-transparent px-3 py-0 text-base font-medium text-white focus:outline-none focus:ring-0';

export const adornedLeading =
	'text-secondary-500 border-secondary-700 flex shrink-0 items-center border-r px-3';

export const adornedTrailing =
	'text-secondary-500 border-secondary-700 flex shrink-0 items-center border-l px-3';

export const adornedActions = 'border-secondary-700 flex shrink-0 items-center border-l px-1.5';

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
	'border-secondary-800 bg-gray-950 overflow-hidden rounded-md border p-0 shadow-none';

export const tooltipPanel = cn(
	'block max-w-72 rounded-md border px-3 py-2',
	'text-left text-sm leading-snug font-medium text-white',
	'border-secondary-800 bg-gray-950 shadow-lg shadow-black/30'
);

/** A section of an edge-to-edge popover (`tooltipPanel` with `p-0`): full-width divider on top. */
export const popoverSection = 'border-secondary-800 border-t px-3 py-2.5';

export const dropdownHeader =
	'border-secondary-800 flex items-center justify-between border-b px-4 py-3';

export const dropdownSubheader = 'border-secondary-800 border-b px-4 py-3';

export const dropdownItem = cn(
	'text-secondary-200 cursor-pointer items-center rounded-sm px-3 py-2 text-sm transition-colors',
	'hover:bg-secondary-800/40 data-highlighted:bg-secondary-800/40 hover:text-white data-highlighted:text-white'
);

export const dropdownItemIcon = 'flex gap-3 text-white';

export const menuItem = dropdownItem;

export const interactive = 'cursor-pointer disabled:cursor-not-allowed';

export const calendarNavButton = cn(
	interactive,
	'text-secondary-300 hover:bg-secondary-800 flex size-8 items-center justify-center rounded-md hover:text-white'
);

export const calendarHeadCell = 'text-secondary-500 w-9 pb-1 text-center text-xs font-normal';

export const calendarDay = cn(
	interactive,
	'text-secondary-200 flex size-9 items-center justify-center rounded-md text-sm tabular-nums',
	'hover:bg-secondary-800 hover:text-white',
	'data-outside-month:pointer-events-none data-outside-month:opacity-0',
	'data-disabled:text-secondary-700 data-unavailable:text-secondary-700',
	'data-today:font-bold data-today:text-white'
);

export const tableHeadText =
	'font-sans text-xs font-semibold tracking-wide text-secondary-300 uppercase';

export const tableHeadRow = `bg-secondary-950/90 border-secondary-800 border-b ${tableHeadText}`;

export const tableSortHeader = `${interactive} ${tableHeadText} flex w-full min-w-0 items-center bg-transparent p-0 select-none`;

export const tabTrigger =
	`${interactive} text-white h-8 rounded-md border border-transparent px-4 font-bold transition-colors duration-150 ` +
	'not-disabled:hover:bg-secondary-950/50 ' +
	'not-disabled:data-[state=active]:border-primary/20 not-disabled:data-[state=active]:bg-primary/5 not-disabled:data-[state=active]:text-primary ' +
	'disabled:text-secondary-500';

/**
 * Flush page tab (`Tabs.Trigger` default): muted bold label with a primary bar along the bottom
 * of the strip when active. Put the strip's own line (`border-b`) on the list or panel.
 */
export const lineTabTrigger = cn(
	interactive,
	'text-secondary-400 relative inline-flex h-11 shrink-0 items-center gap-2 font-bold whitespace-nowrap transition-colors duration-150',
	'not-disabled:hover:text-white focus-visible:text-white focus-visible:outline-none',
	'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-t-full after:bg-transparent after:transition-colors after:duration-150',
	'not-disabled:data-[state=active]:after:bg-primary not-disabled:data-[state=active]:text-white',
	'disabled:text-secondary-600'
);

/** Warm block for what a row unlocks or researches (a building's upgrades, a doctrine tier's unlocks). */
export const accentBlock = cn(
	'from-primary/[0.14] to-primary/[0.05] bg-linear-to-b',
	'shadow-[inset_2px_0_0_var(--color-primary)]'
);

/** The orange label at the top of an `accentBlock`. */
export const accentBlockLabel = cn(
	tableHeadText,
	'text-primary flex items-center gap-1.5 px-4 pt-2.5 pb-1.5'
);

/** Bold page tab (stats mode, wiki factions); the selected one (`data-state="on"`) gets the dark secondary fill. */
export const pageTab = cn(
	'inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-transparent px-4 font-bold whitespace-nowrap text-white transition-colors duration-150',
	'disabled:text-secondary-500 cursor-pointer disabled:cursor-not-allowed',
	'not-disabled:hover:bg-secondary-950/50',
	'data-[state=on]:border-secondary-700 data-[state=on]:bg-secondary-800 data-[state=on]:not-disabled:hover:bg-secondary-800'
);

/**
 * Spreadsheet-style tab on top of a panel. The active tab uses the header background
 * (`gray-950`, same as the replay timeline toolbar) and covers the strip's bottom line (an
 * inset shadow) so it flows into the panel below. Pass as `class` on `Tabs.Trigger`.
 */
export const sheetTabTrigger = cn(
	interactive,
	'flex h-8 max-w-56 shrink-0 items-center gap-2 px-3 py-0 text-sm font-medium',
	'rounded-t-md rounded-b-none border border-b-0 border-white/10 transition-colors duration-150',
	'bg-secondary-950/70 text-secondary-400 not-disabled:hover:bg-secondary-900 not-disabled:hover:text-white',
	'not-disabled:data-[state=active]:relative not-disabled:data-[state=active]:z-10',
	'not-disabled:data-[state=active]:border-white/15 not-disabled:data-[state=active]:bg-gray-950 not-disabled:data-[state=active]:text-[#ece4cf]'
);

/**
 * Series colours for multi-line charts (one per player). Muted to sit next to the gold
 * `primary` and the game resource colours on the dark surfaces.
 */
export const chartSeriesColours = [
	'#7fb2e5',
	'#e8c766',
	'#e07a6f',
	'#8fca8a',
	'#c49be0',
	'#5fc4bd',
	'#e6a15c',
	'#d98bb3'
] as const;

export const mePlayerText = 'text-primary font-semibold';

/** Win/loss tint for a team cell — same tokens as the lobby result rows. */
export function outcomeSurface(outcome: 'win' | 'loss' | null | undefined): string {
	if (outcome === 'win') {
		return 'bg-success/5';
	}

	if (outcome === 'loss') {
		return 'bg-destructive/5';
	}

	return '';
}

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

/** Rendered markdown (comments, replay descriptions, docs tips). */
export const markdownProse = cn(
	'prose prose-sm text-secondary-200 max-w-none min-w-0 break-words',
	'prose-headings:my-1 prose-headings:text-sm prose-headings:leading-snug prose-headings:text-white',
	'prose-h1:text-base prose-strong:text-white',
	'prose-code:bg-secondary-800 prose-code:text-primary prose-code:rounded prose-code:px-1 prose-code:py-0.5',
	'prose-code:before:content-none prose-code:after:content-none',
	'prose-pre:my-1 prose-pre:overflow-x-auto prose-pre:bg-secondary-900 prose-pre:border-secondary-800 prose-pre:border',
	'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
	'prose-blockquote:border-secondary-700 prose-blockquote:text-primary',
	'prose-li:marker:text-secondary-400',
	'[&_mark]:bg-primary/20 [&_mark]:text-primary [&_mark]:rounded-sm',
	'[&_.mention]:text-primary [&_.mention]:font-medium',
	'[&_a.mention]:cursor-pointer hover:[&_a.mention]:underline',
	'prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-blockquote:my-1',
	'[&>*:first-child]:mt-0 [&>*:last-child]:mb-0'
);
