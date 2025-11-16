import { Bootable } from '../bootable.svelte';

export class Settings extends Bootable {
	/**
	 * Path to the Company of Heroes configuration file.
	 *
	 * @default ''
	 * @public
	 */
	companyOfHeroesConfigPath = $state('');

	async boot(): Promise<this> {
		return this;
	}
}
