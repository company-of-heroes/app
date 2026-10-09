<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import { useHost } from '../host/host.context';
	import { FORMAT_LABELS, parseTournamentDate } from './format';
	import type { Tournament } from './types';

	type Props = {
		/** Player whose tournament wins to show. */
		steamId: string;
	};

	let { steamId }: Props = $props();
	const { t } = useI18n();
	const host = useHost();
	const uid = $props.id();
	const medals = host.resolve.medals();

	const won = $derived(host.api.tournaments.wonBy(steamId).catch((): Tournament[] => []));

	/** Service-ribbon colours: crimson, navy, olive, khaki, bone, black. */
	const RIBBON = ['#8f2232', '#24406b', '#56622e', '#b8924a', '#e6dfcc', '#1c1c1c'];

	/** A symmetric five-stripe ribbon picked from the tournament id, so every tournament has its own medal. */
	function ribbon(id: string): string[] {
		let hash = 0;
		for (const char of id) {
			hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
		}

		const outer = RIBBON[hash % RIBBON.length];
		const inner = RIBBON[(hash >>> 3) % RIBBON.length];
		const centre = RIBBON[(hash >>> 6) % RIBBON.length];
		return [outer, inner, centre === inner ? outer : centre, inner, outer];
	}

	const STRIPES = [4, 3, 6, 3, 4];
	const offsets = STRIPES.map((_, i) => 4 + STRIPES.slice(0, i).reduce((a, b) => a + b, 0));
</script>

{#snippet medal(tournament: Tournament, index: number)}
	{@const id = `${uid}-${index}`}
	{@const colors = ribbon(tournament.id)}
	<svg viewBox="0 0 28 50" class="h-20 w-auto shrink-0 drop-shadow-[0_2px_2px_rgb(0_0_0/0.6)]">
		<defs>
			<clipPath id="{id}-ribbon">
				<polygon points="4,0 24,0 24,21 14,25 4,21" />
			</clipPath>
			<clipPath id="{id}-face">
				<circle cx="14" cy="37" r="8" />
			</clipPath>
			<radialGradient id="{id}-gold" cx="35%" cy="30%" r="75%">
				<stop offset="0" stop-color="#fbe6a2" />
				<stop offset="0.55" stop-color="#d1a23f" />
				<stop offset="1" stop-color="#7d5a17" />
			</radialGradient>
		</defs>
		<g clip-path="url(#{id}-ribbon)">
			{#each colors as color, i (i)}
				<rect x={offsets[i]} y="0" width={STRIPES[i]} height="26" fill={color} />
			{/each}
			<rect x="4" y="0" width="20" height="26" fill="url(#{id}-gold)" opacity="0.12" />
		</g>
		<circle cx="14" cy="26" r="2" fill="none" stroke="#c9993a" stroke-width="1.2" />
		<circle cx="14" cy="37" r="11" fill="url(#{id}-gold)" />
		<circle cx="14" cy="37" r="9" fill="none" stroke="#7d5a17" stroke-width="0.8" />
		{#if tournament.logoUrl}
			<image
				href={tournament.logoUrl}
				x="6"
				y="29"
				width="16"
				height="16"
				preserveAspectRatio="xMidYMid slice"
				clip-path="url(#{id}-face)"
			/>
			<circle cx="14" cy="37" r="8" fill="none" stroke="#5c4210" stroke-width="0.6" />
		{:else}
			<polygon
				points="14,30.5 15.6,35 20.3,35.1 16.6,38 17.9,42.6 14,39.9 10.1,42.6 11.4,38 7.7,35.1 12.4,35"
				fill="#7d5a17"
			/>
		{/if}
	</svg>
{/snippet}

{#await won then tournaments}
	{#if tournaments.length > 0}
		{@const latest = ribbon(tournaments[0].id)}
		<section
			aria-labelledby="{uid}-title"
			class="border-secondary-800 bg-warning/[0.06] relative overflow-clip border-b"
		>
			<div class="flex h-1" aria-hidden="true">
				{#each latest as color, i (i)}
					<span class="h-full" style:background={color} style:flex-grow={STRIPES[i]}></span>
				{/each}
			</div>
			<div class="border-warning/15 flex items-baseline gap-3 border-b px-4 py-3">
				<h2 id="{uid}-title" class="font-heading text-warning text-lg font-bold">
					{t('Tournament titles')}
				</h2>
				<span class="text-secondary-400 text-sm tabular-nums">
					{t('{count} won', { count: tournaments.length })}
				</span>
			</div>
			<div class="-mb-px overflow-hidden">
				<ul class="-mr-px grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
					{#each tournaments as tournament, index (tournament.id)}
						{@const date = parseTournamentDate(tournament.startsAt)}
						{@const picked = medals.find((m) => m.key === tournament.medal)}
						<li class="border-warning/15 min-w-0 border-r border-b">
							<a
								href={host.routes.tournament(tournament.slug)}
								aria-label={t('Won {name}', { name: tournament.name })}
								class={cn(
									interactive,
									'group hover:bg-warning/[0.06] flex items-center gap-4 px-4 py-4'
								)}
							>
								{#if picked}
									<img
										src={picked.url}
										alt=""
										class="h-24 w-auto shrink-0 drop-shadow-[0_2px_2px_rgb(0_0_0/0.6)]"
									/>
								{:else}
									{@render medal(tournament, index)}
								{/if}
								<span class="flex min-w-0 flex-col gap-1">
									<span
										class="font-heading truncate text-xl leading-tight font-bold text-white underline-offset-4 group-hover:underline"
									>
										{tournament.name}
									</span>
									<span class="text-warning text-sm font-semibold">{t('Champion')}</span>
									<span class="text-secondary-400 flex flex-wrap gap-x-3 text-xs tabular-nums">
										<span>{t(FORMAT_LABELS[tournament.format])}</span>
										<span>{t('{count} players', { count: tournament.participantCount })}</span>
										{#if date}
											<span>{new Date(date).getFullYear()}</span>
										{/if}
									</span>
								</span>
							</a>
						</li>
					{/each}
				</ul>
			</div>
		</section>
	{/if}
{/await}
