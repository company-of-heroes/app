/**
 * Replay action icons from shared-assets, keyed by file name without `.png`.
 * Relative glob (not kit alias) so Rolldown/Vite always expands the files; `no-inline`
 * keeps the icons and timeline art out of the JS bundle.
 */
const actionIconModules = import.meta.glob<string>('../../../../shared-assets/actions/*.{png,webp}', {
	eager: true,
	query: '?no-inline',
	import: 'default'
});

const actionIconsByKey = new Map(
	Object.entries(actionIconModules).map(([path, url]) => {
		const key = path.replace(/^.*[\/]/, '').replace(/\.(png|webp)$/, '');
		return [key, url] as const;
	})
);

export function getActionIcon(key: string): string | undefined {
	return actionIconsByKey.get(key);
}
