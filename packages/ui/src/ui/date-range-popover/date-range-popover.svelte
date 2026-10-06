<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { getLocalTimeZone, parseDate, today, type DateValue } from '@internationalized/date';
	import { Popover, RangeCalendar, type DateRange } from 'bits-ui';
	import CaretLeftIcon from 'phosphor-svelte/lib/CaretLeftIcon';
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';
	import { tryUseHost } from '../../host/host.context';
	import { dropdownPanel, interactive } from '../../variants';

	type Props = {
		open: boolean;
		/** Element (or CSS selector) the calendar opens below, e.g. a "Custom" toggle. */
		anchor: string | HTMLElement | null;
		/** Selected days as YYYY-MM-DD. */
		from?: string | null;
		to?: string | null;
		/** Called once both ends are picked; the popover then closes. */
		onChange: (from: string, to: string) => void;
		/** Latest selectable day (YYYY-MM-DD); defaults to today. */
		max?: string;
		onOpenChange?: (open: boolean) => void;
	};

	let { open = $bindable(false), anchor, from, to, onChange, max, onOpenChange }: Props = $props();
	const host = tryUseHost();

	function toDate(value: string | null | undefined): DateValue | undefined {
		try {
			return value ? parseDate(value) : undefined;
		} catch {
			return undefined;
		}
	}

	const maxValue = $derived(toDate(max) ?? today(getLocalTimeZone()));
	let value = $derived<DateRange>({ start: toDate(from), end: toDate(to) });

	function onValueChange(range: DateRange) {
		if (range.start && range.end) {
			open = false;
			onOpenChange?.(false);
			onChange(range.start.toString(), range.end.toString());
		}
	}

	const navButton = cn(
		interactive,
		'text-secondary-300 hover:bg-secondary-800 flex size-8 items-center justify-center rounded-md hover:text-white'
	);
</script>

<Popover.Root bind:open {onOpenChange}>
	<Popover.Portal>
		<Popover.Content
			customAnchor={anchor}
			side="bottom"
			align="end"
			sideOffset={6}
			class={cn(dropdownPanel, 'z-50 p-1.5')}
		>
			<RangeCalendar.Root
				bind:value
				{onValueChange}
				{maxValue}
				locale={host?.locale() ?? 'en'}
				weekdayFormat="short"
				fixedWeeks
			>
				{#snippet children({ months, weekdays })}
					<RangeCalendar.Header class="flex items-center justify-between gap-2">
						<RangeCalendar.PrevButton class={navButton}>
							<CaretLeftIcon size={16} />
						</RangeCalendar.PrevButton>
						<RangeCalendar.Heading class="text-sm font-medium text-white" />
						<RangeCalendar.NextButton class={navButton}>
							<CaretRightIcon size={16} />
						</RangeCalendar.NextButton>
					</RangeCalendar.Header>
					<div class="mt-3 flex flex-col gap-4 sm:flex-row">
						{#each months as month (month.value.toString())}
							<RangeCalendar.Grid class="border-collapse select-none">
								<RangeCalendar.GridHead>
									<RangeCalendar.GridRow class="flex">
										{#each weekdays as day (day)}
											<RangeCalendar.HeadCell
												class="text-secondary-500 w-9 pb-1 text-center text-xs font-normal"
											>
												{day.slice(0, 2)}
											</RangeCalendar.HeadCell>
										{/each}
									</RangeCalendar.GridRow>
								</RangeCalendar.GridHead>
								<RangeCalendar.GridBody>
									{#each month.weeks as week (week[0].toString())}
										<RangeCalendar.GridRow class="flex">
											{#each week as date (date.toString())}
												<RangeCalendar.Cell {date} month={month.value} class="p-0">
													<RangeCalendar.Day
														class={cn(
															interactive,
															'text-secondary-200 flex size-9 items-center justify-center rounded-md text-sm tabular-nums',
															'hover:bg-secondary-800 hover:text-white',
															'data-outside-month:pointer-events-none data-outside-month:opacity-0',
															'data-disabled:text-secondary-700 data-unavailable:text-secondary-700',
															'data-today:font-bold data-today:text-white',
															'data-highlighted:bg-primary/10 data-highlighted:rounded-none',
															'data-selected:bg-primary/15 data-selected:rounded-none data-selected:text-white',
															'data-selection-start:bg-primary data-selection-start:rounded-l-md data-selection-start:text-gray-950',
															'data-selection-end:bg-primary data-selection-end:rounded-r-md data-selection-end:text-gray-950'
														)}
													/>
												</RangeCalendar.Cell>
											{/each}
										</RangeCalendar.GridRow>
									{/each}
								</RangeCalendar.GridBody>
							</RangeCalendar.Grid>
						{/each}
					</div>
				{/snippet}
			</RangeCalendar.Root>
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
