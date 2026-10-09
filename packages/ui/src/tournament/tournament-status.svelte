<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import type { SemanticVariant } from '../variants';
	import { Badge } from '../ui/badge';
	import { STATUS_LABELS } from './format';
	import type { TournamentStatus } from './types';

	type Props = {
		status: TournamentStatus;
		class?: string;
	};

	let { status, class: className }: Props = $props();
	const { t } = useI18n();

	const VARIANTS: Record<TournamentStatus, SemanticVariant | 'primary'> = {
		draft: 'default',
		registration: 'success',
		seeding: 'info',
		in_progress: 'primary',
		completed: 'default',
		cancelled: 'destructive'
	};
</script>

<Badge variant={VARIANTS[status]} pulse={status === 'in_progress'} class={className}>
	{t(STATUS_LABELS[status])}
</Badge>
