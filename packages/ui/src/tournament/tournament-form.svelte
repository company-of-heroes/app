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
	import TournamentPlayersField from './tournament-players-field.svelte';
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
	let semisBestOf = $state(String(initial?.semisBestOf ?? ''));
	let quartersBestOf = $state(String(initial?.quartersBestOf ?? ''));
	let grandFinalReset = $state(initial?.grandFinalReset ?? true);
	let registrationClosesAt = $state(toLocalInput(initial?.registrationClosesAt ?? null));
	let startsAt = $state(toLocalInput(initial?.startsAt ?? null));
	let maxParticipants = $state<number | undefined>(initial?.maxParticipants ?? undefined);
	let mapPool = $state<string[]>(initial?.mapPool.map((map) => map.ref) ?? []);
	/** New tournament only: Steam ids signed up right after it is created. */
	let players = $state<string[]>([]);
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
			semisBestOf: format === 'single_elim' && semisBestOf ? Number(semisBestOf) : null,
			quartersBestOf: format === 'single_elim' && quartersBestOf ? Number(quartersBestOf) : null,
			grandFinalReset,
			registrationClosesAt: fromLocalInput(registrationClosesAt),
			startsAt: fromLocalInput(startsAt),
			maxParticipants: maxParticipants ? Number(maxParticipants) : null,
			mapPool,
			medal,
			streamUrl: streamUrl.trim() || null
		};
	}

	/** Back to draft: only while registration is open and nobody signed up (the server checks too). */
	const canUnpublish = $derived(
		tournament?.status === 'registration' && tournament.participantCount === 0
	);

	/** Signs up the listed players one by one; returns the ones that failed, with the reason. */
	async function addPlayers(id: string): Promise<string[]> {
		const failed: string[] = [];
		for (const steamId of players) {
			try {
				await host.api.tournaments.addParticipant(id, steamId);
			} catch (error) {
				failed.push(
					`${steamId} (${error instanceof Error ? t(error.message) : t('Something went wrong.')})`
				);
			}
		}

		return failed;
	}

	/** `status`: also publish (open registration) or take it back to draft. */
	async function save(status?: 'draft' | 'registration') {
		if (saving || !name.trim()) {
			return;
		}

		saving = true;
		saveError = null;
		try {
			const data = input();
			const images = { banner, logo, clearBanner, clearLogo };
			let saved = tournament
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
								: { ...data, ...(status ? { status } : {}) },
						images
					)
				: await host.api.tournaments.create(data, images);
			// A new tournament is always a draft first. Open registration before adding players,
			// so they get the "you are signed up" notice.
			if (!tournament && status === 'registration') {
				saved = await host.api.tournaments.update(saved.id, { status });
			}

			if (!tournament && players.length) {
				const failed = await addPlayers(saved.id);
				if (failed.length) {
					host.notify.error(
						t('Could not add {count} players: {players}', {
							count: failed.length,
							players: failed.join(', ')
						})
					);
				}
			}

			host.notify.success(
				status === 'registration'
					? t('Registration is open.')
					: status === 'draft' || !tournament
						? t('Saved as draft.')
						: t('Tournament saved.')
			);
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
		description={started
			? t('The format cannot change after the tournament started.')
			: format === 'double_elim'
				? t(
						'Length of the grand final. With a reset, the winners-bracket player must be beaten twice.'
					)
				: undefined}
		wide
	>
		<div class="grid max-w-3xl gap-3 sm:grid-cols-3">
			<div class="flex min-w-0 flex-col gap-1">
				<span class="text-secondary-400 text-xs">{t('Bracket')}</span>
				<Select
					items={formatItems}
					type="single"
					bind:value={format}
					disabled={started}
					aria-label={t('Format')}
				/>
			</div>
			<div class="flex min-w-0 flex-col gap-1">
				<span class="text-secondary-400 text-xs">{t('Match length')}</span>
				<Select
					items={bestOfItems}
					type="single"
					bind:value={bestOf}
					disabled={started}
					aria-label={t('Match length')}
				/>
			</div>
			{#if format === 'single_elim'}
				<div class="flex min-w-0 flex-col gap-1">
					<span class="text-secondary-400 text-xs">{t('Quarterfinals')}</span>
					<Select
						items={finalsItems}
						type="single"
						bind:value={quartersBestOf}
						disabled={started}
						aria-label={t('Quarterfinals')}
					/>
				</div>
				<div class="flex min-w-0 flex-col gap-1">
					<span class="text-secondary-400 text-xs">{t('Semifinals')}</span>
					<Select
						items={finalsItems}
						type="single"
						bind:value={semisBestOf}
						disabled={started}
						aria-label={t('Semifinals')}
					/>
				</div>
			{/if}
			{#if format !== 'round_robin'}
				<div class="flex min-w-0 flex-col gap-1">
					<span class="text-secondary-400 text-xs">{t('Final')}</span>
					<Select
						items={finalsItems}
						type="single"
						bind:value={finalsBestOf}
						disabled={started}
						aria-label={t('Final')}
					/>
				</div>
			{/if}
		</div>
		{#if format === 'double_elim'}
			<Checkbox bind:checked={grandFinalReset} disabled={started} label={t('Grand final reset')} />
		{/if}
	</Form.Group>

	<Form.Group label={t('Schedule')} description={t('Times are in your local time zone.')} wide>
		<div class="grid max-w-3xl gap-3 sm:grid-cols-3">
			<div class="flex min-w-0 flex-col gap-1">
				<span class="text-secondary-400 text-xs">{t('Registration closes')}</span>
				<DatePicker
					time
					bind:value={registrationClosesAt}
					disabled={started}
					aria-label={t('Registration closes')}
					calendarLabel={t('Open calendar')}
				/>
			</div>
			<div class="flex min-w-0 flex-col gap-1">
				<span class="text-secondary-400 text-xs">{t('Starts')}</span>
				<DatePicker
					time
					bind:value={startsAt}
					disabled={started}
					aria-label={t('Starts')}
					calendarLabel={t('Open calendar')}
				/>
			</div>
			<div class="flex min-w-0 flex-col gap-1">
				<label for="tournament-max" class="text-secondary-400 text-xs">{t('Maximum players')}</label
				>
				<Input
					id="tournament-max"
					type="number"
					min={2}
					max={256}
					placeholder={t('No limit')}
					bind:value={maxParticipants}
					disabled={started}
				/>
			</div>
		</div>
	</Form.Group>

	{#if !tournament}
		<Form.Group
			label={t('Players')}
			description={t(
				'Optional. Search players by name or Steam ID; they are added when the tournament is created.'
			)}
		>
			<TournamentPlayersField
				bind:value={players}
				max={maxParticipants ? Number(maxParticipants) : null}
				disabled={saving}
			/>
		</Form.Group>
	{/if}

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
		label={t('Images')}
		description={t('Logo is square, max 2 MB. Banner is about 4:1, max 5 MB. JPEG, PNG or WebP.')}
		wide
	>
		<div class="flex flex-wrap items-start gap-3">
			<div class="flex flex-col gap-1">
				<span class="text-secondary-400 text-xs">{t('Logo')}</span>
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
			</div>
			<div class="flex min-w-0 flex-1 flex-col gap-1">
				<span class="text-secondary-400 text-xs">{t('Banner')}</span>
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
			</div>
		</div>
	</Form.Group>

	<Form.Group
		label={t('Champion medal')}
		description={t('The winner gets this medal on their profile.')}
	>
		<TournamentMedalField bind:value={medal} tournamentId={tournament?.id} disabled={saving} />
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
				{#if !tournament || tournament.status === 'draft'}
					<Button
						type="button"
						loading={saving}
						disabled={saving || !name.trim()}
						onclick={() => save('registration')}
					>
						{tournament ? t('Save and open registration') : t('Create and open registration')}
					</Button>
					<Button type="submit" variant="secondary" disabled={saving || !name.trim()}>
						{t('Save as draft')}
					</Button>
				{:else}
					<Button type="submit" loading={saving} disabled={saving || !name.trim()}>
						{t('Save tournament')}
					</Button>
					{#if tournament.status === 'registration'}
						<Button
							type="button"
							variant="secondary"
							disabled={saving || !name.trim() || !canUnpublish}
							onclick={() => save('draft')}
						>
							{t('Save as draft')}
						</Button>
						{#if !canUnpublish}
							<p class="text-secondary-400 text-xs">
								{t('Players already signed up, so it cannot go back to draft.')}
							</p>
						{/if}
					{/if}
				{/if}
				{#if saveError}
					<p class="text-destructive text-sm">{saveError}</p>
				{/if}
			</div>
		{/snippet}
	</Form.Group>
</Form.Root>
