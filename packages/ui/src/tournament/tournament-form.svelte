<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { untrack } from 'svelte';
	import {
		TOURNAMENT_BANNER_MAX_BYTES,
		TOURNAMENT_BEST_OF,
		TOURNAMENT_FORMATS,
		TOURNAMENT_LOGO_MAX_BYTES
	} from '@company-of-heroes/api/tournaments';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import { DatePicker } from '../ui/date-picker';
	import { MarkdownEditor } from '../ui/editor';
	import * as Form from '../ui/form';
	import { Checkbox, Input, Select } from '../ui/input';
	import { FORMAT_LABELS, fromLocalInput, toLocalInput } from './format';
	import TournamentImageField from './tournament-image-field.svelte';
	import TournamentMapPoolField from './tournament-map-pool-field.svelte';
	import TournamentMedalField from './tournament-medal-field.svelte';
	import type { Tournament, TournamentFormat, TournamentInput } from './types';

	type Props = {
		/** Edit this tournament; without it the form creates a new one. */
		tournament?: Tournament;
	};

	let { tournament }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const initial = untrack(() => tournament);
	const started = $derived(
		!!tournament && !['draft', 'registration', 'seeding'].includes(tournament.status)
	);

	let name = $state(initial?.name ?? '');
	let description = $state(initial?.description ?? '');
	let rules = $state(initial?.rules ?? '');
	let format = $state<string>(initial?.format ?? 'single_elim');
	let bestOf = $state(String(initial?.bestOf ?? 3));
	let finalsBestOf = $state(String(initial?.finalsBestOf ?? ''));
	let grandFinalReset = $state(initial?.grandFinalReset ?? true);
	let registrationClosesAt = $state(toLocalInput(initial?.registrationClosesAt ?? null));
	let startsAt = $state(toLocalInput(initial?.startsAt ?? null));
	let maxParticipants = $state<number | undefined>(initial?.maxParticipants ?? undefined);
	let mapPool = $state<string[]>(initial?.mapPool.map((map) => map.ref) ?? []);
	let medal = $state<string | null>(initial?.medal ?? null);
	let streamUrl = $state(initial?.streamUrl ?? '');
	let banner = $state<File | null>(null);
	let clearBanner = $state(false);
	let logo = $state<File | null>(null);
	let clearLogo = $state(false);
	let saving = $state(false);
	let saveError = $state<string | null>(null);

	const formatItems = $derived(
		TOURNAMENT_FORMATS.map((value) => ({ value, label: t(FORMAT_LABELS[value]) }))
	);
	const bestOfItems = $derived(
		TOURNAMENT_BEST_OF.map((value) => ({
			value: String(value),
			label: t('Best of {count}', { count: value })
		}))
	);
	const finalsItems = $derived([{ value: '', label: t('Same as other matches') }, ...bestOfItems]);

	function input(): TournamentInput {
		return {
			name: name.trim(),
			description: description.trim(),
			rules: rules.trim(),
			format: format as TournamentFormat,
			bestOf: Number(bestOf),
			finalsBestOf: finalsBestOf ? Number(finalsBestOf) : null,
			grandFinalReset,
			registrationClosesAt: fromLocalInput(registrationClosesAt),
			startsAt: fromLocalInput(startsAt),
			maxParticipants: maxParticipants ? Number(maxParticipants) : null,
			mapPool,
			medal,
			streamUrl: streamUrl.trim() || null
		};
	}

	async function save() {
		if (saving || !name.trim()) {
			return;
		}

		saving = true;
		saveError = null;
		try {
			const data = input();
			const images = { banner, logo, clearBanner, clearLogo };
			const saved = tournament
				? await host.api.tournaments.update(
						tournament.id,
						tournament.status === 'completed'
							? { medal: data.medal }
							: started
								? {
										name: data.name,
										description: data.description,
										rules: data.rules,
										mapPool: data.mapPool,
										medal: data.medal,
										streamUrl: data.streamUrl
									}
								: data,
						images
					)
				: await host.api.tournaments.create(data, images);
			host.notify.success(tournament ? t('Tournament saved.') : t('Tournament created.'));
			await host.url.goto(host.routes.tournament(saved.slug));
		} catch (error) {
			saveError = error instanceof Error ? t(error.message) : t('Could not save the tournament.');
		} finally {
			saving = false;
		}
	}
</script>

<Form.Root
	onsubmit={(event) => {
		event.preventDefault();
		void save();
	}}
>
	<Form.Group label={t('Name')} inputId="tournament-name" required>
		<Input id="tournament-name" bind:value={name} maxlength={120} required />
	</Form.Group>

	<Form.Group
		label={t('Format')}
		description={started ? t('The format cannot change after the tournament started.') : undefined}
	>
		<div class="flex flex-col gap-3 sm:flex-row">
			<Select
				items={formatItems}
				type="single"
				bind:value={format}
				disabled={started}
				aria-label={t('Format')}
			/>
			<Select
				items={bestOfItems}
				type="single"
				bind:value={bestOf}
				disabled={started}
				aria-label={t('Match length')}
			/>
		</div>
	</Form.Group>

	<Form.Group
		label={t('Logo')}
		description={t(
			'Square image shown in lists and next to the name. JPEG, PNG or WebP, max 2 MB.'
		)}
	>
		<TournamentImageField
			id="tournament-logo"
			shape="square"
			currentUrl={tournament?.logoUrl ?? null}
			maxBytes={TOURNAMENT_LOGO_MAX_BYTES}
			tooBigMessage="The logo must be 2 MB or smaller."
			bind:file={logo}
			bind:clear={clearLogo}
			disabled={saving}
		/>
	</Form.Group>

	<Form.Group
		label={t('Banner')}
		description={t('Wide image above the tournament, about 4:1. JPEG, PNG or WebP, max 5 MB.')}
		wide
	>
		<TournamentImageField
			id="tournament-banner"
			shape="wide"
			currentUrl={tournament?.bannerUrl ?? null}
			maxBytes={TOURNAMENT_BANNER_MAX_BYTES}
			tooBigMessage="The banner must be 5 MB or smaller."
			bind:file={banner}
			bind:clear={clearBanner}
			disabled={saving}
		/>
	</Form.Group>

	<Form.Group
		label={t('Champion medal')}
		description={t('The winner gets this medal on their profile.')}
	>
		<TournamentMedalField bind:value={medal} disabled={saving} />
	</Form.Group>

	<Form.Group label={t('Description')} wide>
		<MarkdownEditor
			bind:value={description}
			maxLength={5000}
			aria-label={t('Description')}
			placeholder={t('What is this tournament about? Prizes, schedule, stream...')}
			disabled={saving}
		/>
	</Form.Group>

	<Form.Group label={t('Rules')} wide>
		<MarkdownEditor
			bind:value={rules}
			maxLength={5000}
			aria-label={t('Rules')}
			placeholder={t('Allowed factions, map picks, disconnects, no-shows...')}
			disabled={saving}
		/>
	</Form.Group>

	{#if format !== 'round_robin'}
		<Form.Group
			label={t('Final')}
			description={format === 'double_elim'
				? t(
						'Length of the grand final. With a reset, the winners-bracket player must be beaten twice.'
					)
				: t('Length of the final.')}
		>
			<div class="flex flex-col gap-3">
				<Select
					items={finalsItems}
					type="single"
					bind:value={finalsBestOf}
					disabled={started}
					aria-label={t('Final')}
				/>
				{#if format === 'double_elim'}
					<Checkbox
						bind:checked={grandFinalReset}
						disabled={started}
						label={t('Grand final reset')}
					/>
				{/if}
			</div>
		</Form.Group>
	{/if}

	<Form.Group label={t('Schedule')} description={t('Times are in your local time zone.')}>
		<div class="flex flex-col gap-3 sm:flex-row">
			<div class="flex min-w-0 flex-1 flex-col gap-1">
				<span class="text-secondary-400 text-xs">{t('Registration closes')}</span>
				<DatePicker
					time
					bind:value={registrationClosesAt}
					disabled={started}
					aria-label={t('Registration closes')}
					calendarLabel={t('Open calendar')}
				/>
			</div>
			<div class="flex min-w-0 flex-1 flex-col gap-1">
				<span class="text-secondary-400 text-xs">{t('Starts')}</span>
				<DatePicker
					time
					bind:value={startsAt}
					disabled={started}
					aria-label={t('Starts')}
					calendarLabel={t('Open calendar')}
				/>
			</div>
		</div>
	</Form.Group>

	<Form.Group
		label={t('Maximum players')}
		inputId="tournament-max"
		description={t('Leave empty for no limit.')}
	>
		<Input
			id="tournament-max"
			type="number"
			min={2}
			max={256}
			bind:value={maxParticipants}
			disabled={started}
		/>
	</Form.Group>

	<Form.Group
		label={t('Stream link')}
		inputId="tournament-stream"
		description={t('Optional. Where the tournament is cast, e.g. a Twitch or YouTube channel.')}
	>
		<Input
			id="tournament-stream"
			type="url"
			placeholder="https://"
			pattern="https://.*"
			maxlength={500}
			bind:value={streamUrl}
			disabled={saving || tournament?.status === 'completed'}
		/>
	</Form.Group>

	<Form.Group
		label={t('Map pool')}
		description={t('Maps that are played in this tournament.')}
		wide
	>
		<TournamentMapPoolField
			bind:value={mapPool}
			initial={tournament?.mapPool ?? []}
			disabled={saving}
		/>
	</Form.Group>

	<Form.Group>
		{#snippet footer()}
			<div class="flex flex-wrap items-center gap-3">
				<Button type="submit" loading={saving} disabled={saving || !name.trim()}>
					{tournament ? t('Save tournament') : t('Create tournament')}
				</Button>
				{#if saveError}
					<p class="text-destructive text-sm">{saveError}</p>
				{/if}
			</div>
		{/snippet}
	</Form.Group>
</Form.Root>
