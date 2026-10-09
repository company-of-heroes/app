import StatisticsBlueprints from './statistics-blueprints.svelte';
import StatisticsDoctrines from './statistics-doctrines.svelte';
import StatisticsFactions from './statistics-factions.svelte';
import StatisticsFacts from './statistics-facts.svelte';
import StatisticsKeyNumbers from './statistics-key-numbers.svelte';
import StatisticsMaps from './statistics-maps.svelte';
import StatisticsMatchups from './statistics-matchups.svelte';
import StatisticsRoot from './statistics-root.svelte';
import StatisticsSkeleton from './statistics-skeleton.svelte';

export {
	StatisticsBlueprints as Blueprints,
	StatisticsDoctrines as Doctrines,
	StatisticsFactions as Factions,
	StatisticsFacts as Facts,
	StatisticsKeyNumbers as KeyNumbers,
	StatisticsMaps as Maps,
	StatisticsMatchups as Matchups,
	StatisticsRoot as Root,
	StatisticsSkeleton as Skeleton
};
export * from './types';
export { createStatistics, useStatistics, type StatisticsContext } from './context';
export { percent } from './format';
