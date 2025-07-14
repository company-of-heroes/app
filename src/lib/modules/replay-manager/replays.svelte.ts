import type { Component } from 'svelte';
import { Module } from '../module.svelte';
import ReplaysView from './replays-view.svelte';

export class Replays extends Module {
	isInitialized?: boolean | undefined;

	enabled = true;

	name = 'replays';

	isForStreamer = false;

	menuItemName = 'Replays';

	component = ReplaysView;

	init(): void {}
	destroy(): void {}
}
