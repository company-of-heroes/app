import { medalsFrom, type MedalManifestEntry } from '@company-of-heroes/ui/tournament';
import manifest from '../../../../shared-assets/medals/medals.json';

/** Champion medals; relative glob (not kit alias) so Vite expands it, `no-inline` keeps the SVGs out of the JS. */
const urls = import.meta.glob<string>('../../../../shared-assets/medals/*.svg', {
	eager: true,
	query: '?no-inline',
	import: 'default'
});

const medals = medalsFrom(manifest as MedalManifestEntry[], urls);

export const getMedals = () => medals;
