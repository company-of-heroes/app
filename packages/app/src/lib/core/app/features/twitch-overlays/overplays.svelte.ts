import { watch } from 'runed';
import { pocketbase } from '$core/pocketbase';
import { app } from '$core/app/context';
import { Feature } from '../feature.svelte';
import type { Overlay } from './overlays/overlay.svelte.ts';
import OverlayOverwriteConfirm from './overlay-overwrite-confirm.svelte';
import { t } from '$lib/i18n';

/**
 * Registry for the Opponent Bot overlay. Installs local source for editing and
 * publishes to the hosted overlay route on api.coh1stats.com.
 */
export class TwitchOverlays extends Feature {
	name = 'twitch-overlays';

	overlays: Overlay[] = $state([]);

	#disposeWatchers: (() => void) | null = null;
	#ensurePublishedInFlight = false;
	#promptInFlight = false;
	#skippedPendingUpdates = new Set<string>();

	registerOverlay(overlay: Overlay) {
		if (this.overlays.find((o) => o.name === overlay.name)) {
			return;
		}

		this.overlays.push(overlay);
	}

	#pendingUpdateKey(overlay: Overlay) {
		return `${overlay.name}:${overlay.version ?? 'unknown'}`;
	}

	#confirmUpdate(overlay: Overlay): Promise<boolean> {
		return new Promise((resolve) => {
			let settled = false;

			const settle = (value: boolean) => {
				if (settled) {
					return;
				}

				settled = true;
				unsubscribe();
				resolve(value);
				app.modal.close();
			};

			const unsubscribe = app.modal.on('close', () => {
				if (settled) {
					return;
				}

				settled = true;
				unsubscribe();
				resolve(false);
			});

			app.modal.create({
				component: OverlayOverwriteConfirm,
				title: t('Opponent Bot overlay update'),
				description: t('A new version of the oppbot overlay is available.'),
				size: 'md',
				props: {
					version: overlay.version,
					onConfirm: () => settle(true),
					onCancel: () => settle(false)
				}
			});
			app.modal.open();
		});
	}

	async #publishUpdatedOverlay(overlay: Overlay) {
		if (!pocketbase.authStore.isValid) {
			return false;
		}

		try {
			await overlay.publish({ silent: true });
			return true;
		} catch (error) {
			console.warn('[TWITCH-OVERLAYS]: auto-publish failed:', error);
			return false;
		}
	}

	async #promptPendingUpdates(overlays: Overlay[]) {
		if (this.#promptInFlight) {
			return;
		}

		this.#promptInFlight = true;
		try {
			for (const overlay of overlays) {
				const key = this.#pendingUpdateKey(overlay);
				if (this.#skippedPendingUpdates.has(key)) {
					continue;
				}

				if (!(await overlay.hasPendingUpdate())) {
					continue;
				}

				const ok = await this.#confirmUpdate(overlay);
				// Never re-prompt for this version in the same session (yes or no).
				this.#skippedPendingUpdates.add(key);

				if (!ok) {
					continue;
				}

				try {
					await overlay.overwriteWithLatest({ backup: true });
					const published = await this.#publishUpdatedOverlay(overlay);
					app.toast.success(
						published
							? t(
									'Opponent Bot overlay updated and published. Your previous version was backed up.'
								)
							: t('Opponent Bot overlay updated. Your previous version was backed up.')
					);
					if (!published && pocketbase.authStore.isValid) {
						app.toast.error(t('Could not publish the updated overlay to the server.'));
					}
				} catch (error) {
					console.error('[TWITCH-OVERLAYS]: update failed:', error);
					const message =
						error instanceof Error
							? error.message
							: t('Failed to update the Opponent Bot overlay. Check the logs.');
					app.toast.error(message);
				}
			}
		} finally {
			this.#promptInFlight = false;
		}
	}

	async enable() {
		this.#disposeWatchers = $effect.root(() => {
			watch(
				() => [this.overlays, pocketbase.authStore.isValid] as const,
				([overlays, isAuthenticated]) => {
					void (async () => {
						const reinstalled: Overlay[] = [];
						for (const overlay of overlays) {
							if (await overlay.register()) {
								reinstalled.push(overlay);
							}
						}

						await this.#promptPendingUpdates(overlays);

						if (!isAuthenticated || overlays.length === 0 || this.#ensurePublishedInFlight) {
							return;
						}

						this.#ensurePublishedInFlight = true;
						try {
							for (const overlay of reinstalled) {
								await this.#publishUpdatedOverlay(overlay);
							}

							for (const overlay of overlays) {
								await overlay.ensurePublished();
							}
						} catch (error) {
							console.warn('[TWITCH-OVERLAYS]: ensurePublished failed:', error);
						} finally {
							this.#ensurePublishedInFlight = false;
						}
					})();
				}
			);
		});
	}

	async disable() {
		this.#disposeWatchers?.();
		this.#disposeWatchers = null;
	}

	defaultSettings() {
		return { enabled: true };
	}
}

export const twitchOverlays = new TwitchOverlays();
