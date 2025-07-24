import type { HelixPrediction } from '@twurple/api';
import { app } from '$core/app';
import { Bootable } from '../bootable.svelte';
import { debounce } from 'lodash-es';

/**
 * Represents the Twitch Predictions module.
 * Handles automatic creation and resolution of Twitch predictions based on game events.
 */
export class Preditctions extends Bootable {
	/**
	 * Indicates whether Twitch predictions are enabled.
	 * Derived from application settings.
	 *
	 * @readonly
	 * @type {boolean}
	 */
	enabled = $derived(!!app.settings.twitch?.predictionsEnabled);

	/**
	 * Reference to the Twitch module instance.
	 *
	 * @public
	 * @type {any}
	 */
	twitch = $state(app.getModule('twitch'));

	/**
	 * Array containing all predictions for the current user.
	 *
	 * @public
	 * @type {HelixPrediction[]}
	 */
	allPredictions = $state<HelixPrediction[]>([]);

	/**
	 * The currently active prediction.
	 * Undefined if no prediction is currently active or locked.
	 *
	 * @public
	 * @type {HelixPrediction | undefined}
	 */
	activePrediction = $state<HelixPrediction | undefined>(undefined);

	/**
	 * Initializes the predictions module.
	 * Fetches existing predictions and sets up the active prediction if one exists.
	 *
	 * @public
	 * @returns {Promise<void>}
	 */
	async init() {
		if (!this.twitch.user?.userId) {
			console.error('Twitch user ID is not available');
			return;
		}

		const predictions = await this.twitch.client?.predictions.getPredictions(
			this.twitch.user.userId
		);

		this.allPredictions = predictions?.data ?? [];
		this.activePrediction = this.allPredictions.find(
			(prediction) => prediction.status === 'ACTIVE' || prediction.status === 'LOCKED'
		);

		this.start();
	}

	/**
	 * Sets up event listeners for game lobby events.
	 * Creates debounced handlers for starting and ending predictions based on game state.
	 *
	 * @public
	 * @returns {void}
	 */
	start() {
		/**
		 * Debounced function to create a new prediction.
		 * Prevents multiple rapid calls when a game starts.
		 */
		const debouncedStartPrediction = debounce(() => {
			if (!app.game.isIngame) {
				return;
			}

			const title = this.twitch.settings.predictionsTitle;
			const outcomes = this.twitch.settings.predictionsOptions;

			this.createPrediction(title, outcomes);
		}, 500);

		/**
		 * Debounced function to end a prediction based on game outcome.
		 * Prevents multiple rapid calls when a game ends.
		 *
		 * Make sure the debounce time is high enough to allow the game state to settle
		 * This is important to ensure the lobby outcome is correctly set before ending the prediction.
		 */
		const debouncedEndPrediction = debounce(() => {
			const outcomeIndex =
				app.game.lobby!.outcome === 'PS_WON' ? 0 : app.game.lobby!.outcome === 'PS_LOST' ? 1 : -1;

			if (outcomeIndex !== -1) {
				const targetTitle = app.settings.twitch?.predictionsOptions[outcomeIndex];
				const outcome = this.activePrediction?.outcomes.find((o) => o.title === targetTitle);

				if (outcome) {
					this.endPrediction(outcome.id);
				}
			}
		}, 1500);

		app.game.on('LOBBY:STARTED', () => debouncedStartPrediction());
		app.game.on('LOBBY:GAMEOVER', () => debouncedEndPrediction());
	}

	/**
	 * Creates a new Twitch prediction with the specified title and outcomes.
	 * Only creates a prediction if one is not already active.
	 *
	 * @param {string} title - The title/question for the prediction
	 * @param {string[]} outcomes - Array of possible outcomes for the prediction
	 * @public
	 * @returns {Promise<void>}
	 */
	async createPrediction(title: string, outcomes: string[]) {
		if (this.activePrediction) {
			return;
		}

		if (!this.twitch.client || !this.twitch.user || !this.twitch.user.userId) {
			return;
		}

		this.activePrediction = await this.twitch.client.predictions.createPrediction(
			this.twitch.user.userId,
			{
				title,
				outcomes,
				autoLockAfter: this.twitch.settings.predictionsTimer || 300 // Default to 5 minutes if not set
			}
		);
	}

	/**
	 * Ends the currently active prediction by resolving it with the specified outcome.
	 *
	 * @param {string} outcomeId - The ID of the winning outcome
	 * @public
	 * @returns {Promise<void>}
	 */
	async endPrediction(outcomeId: string) {
		if (!this.twitch.client || !this.twitch.user || !this.twitch.user.userId) {
			return;
		}

		if (!this.activePrediction) {
			return;
		}

		await this.twitch.client.predictions.resolvePrediction(
			this.twitch.user.userId,
			this.activePrediction.id,
			outcomeId
		);
		this.activePrediction = undefined;
	}

	/**
	 * Destroys the predictions module.
	 * Clean up any resources or event listeners.
	 *
	 * @public
	 * @returns {Promise<void> | void}
	 */
	destroy(): Promise<void> | void {}
}
