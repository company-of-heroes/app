import type { Component } from 'svelte';
import { watch } from 'runed';
import { tts } from '../tts.svelte';

export type TTSVoice = {
	voiceId: string;
	name: string;
	isDeleting?: boolean;
};

export interface TTSProvider {
	/**
	 * The Svelte component associated with the TTS provider for settings UI.
	 *
	 * @abstract
	 * @type {Component}
	 */
	component?: Component;
}

export abstract class TTSProvider {
	/**
	 * The name of the TTS provider.
	 *
	 * @abstract
	 * @type {string}
	 */
	abstract name: string;
	/**
	 * The available voices for the TTS provider.
	 *
	 * @type {TTSVoice[]}
	 */
	voices: TTSVoice[] = $state([]);
	/**
	 * Indicates whether this TTS provider is currently active.
	 *
	 * @type {boolean}
	 */
	isActive = $derived.by(() => tts.settings.provider === this.name);
	/**
	 * The default voice ID for the TTS provider.
	 *
	 * @type {string | null}
	 */
	defaultVoiceId = $derived.by(() => tts.settings.voiceId || this.voices?.[0]?.voiceId);

	constructor() {
		$effect.root(() => {
			watch(
				() => this.isActive,
				() => {
					if (!this.isActive) {
						return;
					}

					setTimeout(() => this.init(), 100);
				}
			);
		});
	}

	abstract init(): Promise<void> | void;

	abstract synthesize(message: string, voiceId?: string): Promise<Blob>;
}
