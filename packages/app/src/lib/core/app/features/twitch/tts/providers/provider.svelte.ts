import type { Component } from 'svelte';
import { watch } from 'runed';
import { tts } from '../tts.svelte';

export type TTSVoice = {
	voiceId: string;
	name: string;
	alias?: string;
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

	protected applyVoiceAliases() {
		const aliases = tts.settings.providers[this.name]?.voiceAliases as
			| Record<string, string>
			| undefined;

		if (!aliases) {
			return;
		}

		this.voices = this.voices.map((voice) => ({
			...voice,
			alias: aliases[voice.voiceId]
		}));
	}

	setVoiceAlias(voiceId: string, alias: string) {
		const providerSettings = (tts.settings.providers[this.name] ??= {});
		const voiceAliases = (providerSettings.voiceAliases ??= {}) as Record<string, string>;
		const trimmedAlias = alias.trim();

		if (trimmedAlias) {
			voiceAliases[voiceId] = trimmedAlias;
		} else {
			delete voiceAliases[voiceId];
		}

		const voice = this.voices.find((item) => item.voiceId === voiceId);
		if (voice) {
			voice.alias = trimmedAlias || undefined;
		}
	}

	getVoiceLabel(voice: TTSVoice): string {
		return voice.alias?.trim() || voice.name;
	}
}
