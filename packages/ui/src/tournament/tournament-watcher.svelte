<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { onMount, untrack } from 'svelte';
	import { useHost } from '../host/host.context';
	import { modal } from '../ui/modal';
	import { DEADLINE_WARNINGS } from './format';
	import TournamentDeadlinePopup from './tournament-deadline-popup.svelte';
	import TournamentPostPopup from './tournament-post-popup.svelte';
	import TournamentProposalPopup from './tournament-proposal-popup.svelte';
	import TournamentResultPopup from './tournament-result-popup.svelte';
	import TournamentStartPopup from './tournament-start-popup.svelte';
	import type {
		MyTournamentMatch,
		MyTournaments,
		TournamentGameResult,
		TournamentPostNotice,
		TournamentScheduleProposal,
		TournamentStart
	} from './types';

	type Props = {
		/** Only for a signed-in user. */
		enabled: boolean;
		/** How often to look for results and deadlines. */
		intervalMs?: number;
	};

	let { enabled, intervalMs = 60_000 }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const STORAGE_KEY = 'tournament-deadline-warnings';

	/** Shown warnings as `matchId:threshold`; per browser, a missed write only repeats a warning. */
	function warned(): Set<string> {
		try {
			return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[]);
		} catch {
			return new Set();
		}
	}

	function remember(key: string) {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify([...warned(), key].slice(-200)));
		} catch {
			// Private window or blocked storage: the warning may show again.
		}
	}

	/** The smallest warning threshold this match has passed (0 once overdue), or null. */
	function threshold(item: MyTournamentMatch, now: number): number | null {
		if (!item.match.deadline || item.claim?.status === 'playing') {
			return null;
		}

		const left = Date.parse(item.match.deadline) - now;
		if (left < 0) {
			return 0;
		}

		const passed = DEADLINE_WARNINGS.filter((ms) => left <= ms);
		return passed.length ? Math.min(...passed) : null;
	}

	function showResult(result: TournamentGameResult) {
		modal.create({
			title: t('Tournament game processed'),
			component: TournamentResultPopup,
			props: { result },
			size: 'md'
		});
		modal.open();
		void host.api.tournaments.markSeen({ lobbyIds: [result.lobbyId] }).catch(() => {});
	}

	function showStart(start: TournamentStart) {
		modal.create({
			title: t('Tournament started'),
			component: TournamentStartPopup,
			props: { start },
			size: 'md'
		});
		modal.open();
		void host.api.tournaments.markSeen({ started: [start.tournament.id] }).catch(() => {});
		// Its first match is in the popup: no deadline warning for it right after.
		if (start.match) {
			const passed = threshold(start.match, Date.now());
			if (passed !== null) {
				remember(`${start.match.match.id}:${passed}`);
			}
		}
	}

	/** Staff updates marked important: rule changes, a new start time, a cancellation, news. */
	function showPost(notice: TournamentPostNotice) {
		modal.create({
			title: t('Tournament update'),
			component: TournamentPostPopup,
			props: { notice },
			size: 'md'
		});
		modal.open();
		// One popup per tournament: the latest important update covers the earlier ones.
		void host.api.tournaments.markSeen({ posts: [notice.tournament.id] }).catch(() => {});
	}

	/** The opponent proposed times: pick one right away. Once per proposal, like the deadlines. */
	function showProposal(item: MyTournamentMatch, proposal: TournamentScheduleProposal) {
		modal.create({
			title: t('Match time proposed'),
			component: TournamentProposalPopup,
			props: { item, proposal },
			size: 'md'
		});
		modal.open();
		remember(`proposal:${proposal.id}`);
	}

	function showDeadline(item: MyTournamentMatch, key: string) {
		modal.create({
			title: t('Tournament deadline'),
			component: TournamentDeadlinePopup,
			props: { item },
			size: 'md'
		});
		modal.open();
		remember(key);
	}

	/**
	 * One popup at a time: results, started tournaments, important updates, time proposals, then
	 * deadlines. The
	 * next check shows the rest.
	 */
	function present(data: MyTournaments) {
		if (modal.isOpen) {
			return;
		}

		const [result] = data.results;
		if (result) {
			showResult(result);
			return;
		}

		const [start] = data.started ?? [];
		if (start) {
			showStart(start);
			return;
		}

		const latest = (data.posts ?? []).at(-1);
		if (latest) {
			showPost(latest);
			return;
		}

		const now = Date.now();
		const shown = warned();
		for (const item of data.matches) {
			const proposal = item.schedule;
			if (
				proposal?.status === 'pending' &&
				proposal.proposedBy !== item.me.id &&
				proposal.times.some((time) => Date.parse(time) > now) &&
				!shown.has(`proposal:${proposal.id}`)
			) {
				showProposal(item, proposal);
				return;
			}
		}

		for (const item of data.matches) {
			const passed = threshold(item, now);
			const key = `${item.match.id}:${passed}`;
			if (passed !== null && !shown.has(key)) {
				showDeadline(item, key);
				return;
			}
		}
	}

	async function check() {
		if (!enabled || document.visibilityState === 'hidden') {
			return;
		}

		try {
			present(await host.api.tournaments.mine());
		} catch {
			// Offline or signed out meanwhile: try again next time.
		}
	}

	// Right away, and again when the user signs in. Untracked: `check()` calls a remote command.
	$effect(() => {
		if (enabled) {
			untrack(() => void check());
		}
	});

	onMount(() => {
		const timer = setInterval(() => void check(), intervalMs);
		const onVisible = () => void check();
		const off = modal.on('close', () => {
			setTimeout(() => void check(), 800);
		});
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			clearInterval(timer);
			off();
			document.removeEventListener('visibilitychange', onVisible);
		};
	});
</script>
