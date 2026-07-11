
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/(onboarding)" | "/(loading)" | "/(loaded)" | "/" | "/(loaded)/account" | "/(loaded)/admin" | "/(loaded)/admin/notifications" | "/(loaded)/admin/tabs" | "/(loaded)/current-game" | "/(loaded)/history" | "/(loaded)/history/[id]" | "/(loaded)/leaderboards" | "/(loaded)/leaderboards/profile" | "/(loaded)/leaderboards/profile/[profileId]" | "/(loaded)/players" | "/(loaded)/players/[id]" | "/(loaded)/replays" | "/(loaded)/replays/[replayId]" | "/(loaded)/settings" | "/(onboarding)/setup" | "/(loaded)/shortcuts" | "/(loading)/splashscreen" | "/(loaded)/twitch" | "/(loaded)/twitch/tabs" | "/(loaded)/twitch/tabs/bot-tab" | "/(loaded)/twitch/tabs/overlays-tab" | "/(loaded)/twitch/tabs/tts-tab" | "/(loaded)/twitch/tabs/twitch-tab";
		RouteParams(): {
			"/(loaded)/history/[id]": { id: string };
			"/(loaded)/leaderboards/profile/[profileId]": { profileId: string };
			"/(loaded)/players/[id]": { id: string };
			"/(loaded)/replays/[replayId]": { replayId: string }
		};
		LayoutParams(): {
			"/(onboarding)": Record<string, never>;
			"/(loading)": Record<string, never>;
			"/(loaded)": { id?: string | undefined; profileId?: string | undefined; replayId?: string | undefined };
			"/": { id?: string | undefined; profileId?: string | undefined; replayId?: string | undefined };
			"/(loaded)/account": Record<string, never>;
			"/(loaded)/admin": Record<string, never>;
			"/(loaded)/admin/notifications": Record<string, never>;
			"/(loaded)/admin/tabs": Record<string, never>;
			"/(loaded)/current-game": Record<string, never>;
			"/(loaded)/history": { id?: string | undefined };
			"/(loaded)/history/[id]": { id: string };
			"/(loaded)/leaderboards": { profileId?: string | undefined };
			"/(loaded)/leaderboards/profile": { profileId?: string | undefined };
			"/(loaded)/leaderboards/profile/[profileId]": { profileId: string };
			"/(loaded)/players": { id?: string | undefined };
			"/(loaded)/players/[id]": { id: string };
			"/(loaded)/replays": { replayId?: string | undefined };
			"/(loaded)/replays/[replayId]": { replayId: string };
			"/(loaded)/settings": Record<string, never>;
			"/(onboarding)/setup": Record<string, never>;
			"/(loaded)/shortcuts": Record<string, never>;
			"/(loading)/splashscreen": Record<string, never>;
			"/(loaded)/twitch": Record<string, never>;
			"/(loaded)/twitch/tabs": Record<string, never>;
			"/(loaded)/twitch/tabs/bot-tab": Record<string, never>;
			"/(loaded)/twitch/tabs/overlays-tab": Record<string, never>;
			"/(loaded)/twitch/tabs/tts-tab": Record<string, never>;
			"/(loaded)/twitch/tabs/twitch-tab": Record<string, never>
		};
		Pathname(): "/" | "/account" | "/admin" | "/admin/notifications" | "/current-game" | "/history" | `/history/${string}` & {} | "/leaderboards" | `/leaderboards/profile/${string}` & {} | "/players" | `/players/${string}` & {} | "/replays" | `/replays/${string}` & {} | "/settings" | "/setup" | "/shortcuts" | "/splashscreen" | "/twitch";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/favicon.png" | "/fknoobs-app-banner.png" | "/logo-transparent-bg.png" | "/screenshot-v0.35.0.png" | "/screenshot-v0.36.x.png" | "/screenshot.png" | "/svelte.svg" | "/tauri.svg" | "/vite.svg" | string & {};
	}
}