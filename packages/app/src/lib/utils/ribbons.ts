import { ribbonsFrom, type RibbonManifestEntry } from '@company-of-heroes/ui/reward';
import manifest from '../../../../shared-assets/ribbons/ribbons.json';

/** Reward ribbons; relative glob (not kit alias) so Vite expands it, `no-inline` keeps the SVGs out of the JS. */
const urls = import.meta.glob<string>('../../../../shared-assets/ribbons/**/*.svg', {
	eager: true,
	query: '?no-inline',
	import: 'default'
});

const ribbons = ribbonsFrom(manifest as RibbonManifestEntry[], urls);

export const getRibbons = () => ribbons;
