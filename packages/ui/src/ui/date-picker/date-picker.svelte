<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		parseDate,
		parseDateTime,
		type CalendarDate,
		type CalendarDateTime,
		type DateValue
	} from '@internationalized/date';
	import { DatePicker, Popover } from 'bits-ui';
	import CalendarBlankIcon from 'phosphor-svelte/lib/CalendarBlank';
	import CaretLeftIcon from 'phosphor-svelte/lib/CaretLeft';
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRight';
	import { tryUseHost } from '../../host/host.context';
	import {
		adornedActions,
		adornedControl,
		adornedControlDisabled,
		calendarDay,
		calendarHeadCell,
		calendarNavButton,
		dropdownPanel,
		stepperButton
	} from '../../variants';

	export type DatePickerProps = {
		/** `YYYY-MM-DD`, or `YYYY-MM-DDTHH:mm` (local time, like `datetime-local`) with `time`. Empty when unset. */
		value?: string;
		/** Also pick hours and minutes. */
		time?: boolean;
		/** Earliest / latest selectable value, same format as `value`. */
		min?: string;
		max?: string;
		disabled?: boolean;
		hourCycle?: 12 | 24;
		calendarLabel?: string;
		'aria-label'?: string;
		class?: string;
		onValueChange?: (value: string) => void;
	};

	let {
		value = $bindable(''),
		time = false,
		min,
		max,
		disabled = false,
		hourCycle = 24,
		calendarLabel = 'Open calendar',
		'aria-label': ariaLabel,
		class: className,
		onValueChange
	}: DatePickerProps = $props();
	const host = tryUseHost();

	function parse(input: string | undefined): DateValue | undefined {
		if (!input) {
			return undefined;
		}

		try {
			return time ? parseDateTime(input) : parseDate(input.slice(0, 10));
		} catch {
			return undefined;
		}
	}

	function format(date: DateValue | undefined): string {
		if (!date) {
			return '';
		}

		return time
			? (date as CalendarDateTime).toString().slice(0, 16)
			: (date as CalendarDate).toString().slice(0, 10);
	}

	const minValue = $derived(parse(min));
	const maxValue = $derived(parse(max));

	let field = $state<HTMLElement | null>(null);
	let content = $state<HTMLElement | null>(null);

	/**
	 * `DatePicker.Content` focuses the day before the popover is positioned, which scrolls the page
	 * to the top. Use `Popover.Content` instead and focus without scrolling.
	 */
	function onOpenAutoFocus(event: Event) {
		event.preventDefault();
		requestAnimationFrame(() => {
			const day = content?.querySelector<HTMLElement>(
				'[data-bits-day][data-focused], [data-bits-day][data-selected], [data-bits-day][data-today]'
			);
			(day ?? content)?.focus({ preventScroll: true });
		});
	}

	function setValue(date: DateValue | undefined) {
		const next = format(date);
		if (next === value) {
			return;
		}

		value = next;
		onValueChange?.(next);
	}
</script>

<DatePicker.Root
	bind:value={() => parse(value), setValue}
	granularity={time ? 'minute' : 'day'}
	{hourCycle}
	{minValue}
	{maxValue}
	{disabled}
	locale={host?.locale() ?? 'en'}
	weekdayFormat="short"
	fixedWeeks
	closeOnDateSelect={!time}
>
	<DatePicker.Input
		bind:ref={field}
		aria-label={ariaLabel}
		class={cn(
			adornedControl,
			adornedControlDisabled,
			'data-disabled:text-secondary-500 data-disabled:cursor-not-allowed',
			'min-w-0 flex-1 text-white data-invalid:border-red-500/60',
			className
		)}
	>
		{#snippet children({ segments })}
			<div class="flex min-w-0 flex-1 items-center px-3 text-base font-medium tabular-nums">
				{#each segments as { part, value: segment }, i (i)}
					{#if part === 'literal'}
						<DatePicker.Segment {part} class="text-secondary-500 px-px">
							{segment}
						</DatePicker.Segment>
					{:else}
						<DatePicker.Segment
							{part}
							class={cn(
								'rounded-sm px-0.5 focus:outline-none',
								'focus:bg-secondary-800 focus:text-white',
								'aria-[valuetext=Empty]:text-secondary-500',
								'data-disabled:text-secondary-500'
							)}
						>
							{segment}
						</DatePicker.Segment>
					{/if}
				{/each}
			</div>
			<div class={adornedActions}>
				<DatePicker.Trigger class={stepperButton} aria-label={calendarLabel}>
					<CalendarBlankIcon size={16} />
				</DatePicker.Trigger>
			</div>
		{/snippet}
	</DatePicker.Input>
	<DatePicker.Portal>
		<Popover.Content
			customAnchor={field}
			side="bottom"
			align="start"
			sideOffset={6}
			bind:ref={content}
			{onOpenAutoFocus}
			class={cn(dropdownPanel, 'z-50 p-1.5')}
		>
			<DatePicker.Calendar>
				{#snippet children({ months, weekdays })}
					<DatePicker.Header class="flex items-center justify-between gap-2">
						<DatePicker.PrevButton class={calendarNavButton}>
							<CaretLeftIcon size={16} />
						</DatePicker.PrevButton>
						<DatePicker.Heading class="text-sm font-medium text-white" />
						<DatePicker.NextButton class={calendarNavButton}>
							<CaretRightIcon size={16} />
						</DatePicker.NextButton>
					</DatePicker.Header>
					{#each months as month (month.value.toString())}
						<DatePicker.Grid class="mt-3 border-collapse select-none">
							<DatePicker.GridHead>
								<DatePicker.GridRow class="flex">
									{#each weekdays as day (day)}
										<DatePicker.HeadCell class={calendarHeadCell}>
											{day.slice(0, 2)}
										</DatePicker.HeadCell>
									{/each}
								</DatePicker.GridRow>
							</DatePicker.GridHead>
							<DatePicker.GridBody>
								{#each month.weeks as week (week[0].toString())}
									<DatePicker.GridRow class="flex">
										{#each week as date (date.toString())}
											<DatePicker.Cell {date} month={month.value} class="p-0">
												<DatePicker.Day
													class={cn(
														calendarDay,
														'data-selected:bg-primary data-selected:font-semibold data-selected:text-gray-950'
													)}
												/>
											</DatePicker.Cell>
										{/each}
									</DatePicker.GridRow>
								{/each}
							</DatePicker.GridBody>
						</DatePicker.Grid>
					{/each}
				{/snippet}
			</DatePicker.Calendar>
		</Popover.Content>
	</DatePicker.Portal>
</DatePicker.Root>
