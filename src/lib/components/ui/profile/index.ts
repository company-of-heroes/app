import type { SteamPlayerSummary } from '$core/steam';
import type { RelicProfile } from '@fknoobs/app';
import { Context } from 'runed';
import Root from './profile.svelte';
import ProfileAvatar from './profile-avatar.svelte';
import ProfileAlias from './profile-alias.svelte';
import ProfileSteamid from './profile-steamid.svelte';
import ProfileCreated from './profile-created.svelte';
import ProfileFlag from './profile-flag.svelte';
import ProfileStats from './profile-stats.svelte';

const context = new Context<Profile>('<Profile />');

export type Profile = { relic: RelicProfile; steam: SteamPlayerSummary };
export const createProfile = (profile: Profile) => context.set(profile);
export const useProfile = () => context.get();

export {
	Root,
	ProfileAvatar as Avatar,
	ProfileAlias as Alias,
	ProfileSteamid as Steamid,
	ProfileCreated as Created,
	ProfileFlag as Flag,
	ProfileStats as Stats
};
