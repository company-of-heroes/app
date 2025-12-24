import type {
	Collections,
	FileNameString,
	RecordIdString,
	UsersResponse
} from '$core/pocketbase/types';
import { steam, type SteamPlayerSummary } from '$core/steam';
import { relic } from '$lib/relic';
import type { RelicProfile } from '@fknoobs/app';
import { Context } from 'runed';

const userContext = new Context<UserContext>('<user />');
export const createUser = (user: UsersResponse<string[]>) => userContext.set(new UserContext(user));
export const useUser = () => userContext.get();

export class UserContext {
	id = $state<RecordIdString>();

	collectionId = $state<string>();

	collectionName = $state<Collections>();

	avatar = $state<FileNameString>();

	name = $state<string>();

	email = $state<string>();

	steamIds = $state<string[]>([]);

	created = $state<Date>();

	updated = $state<Date>();

	relicProfile = $state<RelicProfile>();

	steamProfile = $state<SteamPlayerSummary>();

	constructor(user: UsersResponse<string[]>) {
		this.id = user.id;
		this.collectionId = user.collectionId;
		this.collectionName = user.collectionName;
		this.avatar = user.avatar;
		this.name = user.name;
		this.email = user.email;
		this.steamIds = user.steamIds || [];
		this.created = new Date(user.created);
		this.updated = new Date(user.updated);
	}

	getRelicProfile() {
		if (this.relicProfile) {
			return Promise.resolve(this.relicProfile);
		}

		return relic.getProfileBySteamId(this.steamIds[0]).then((profile) => {
			if (!profile) {
				return null;
			}

			this.relicProfile = profile;
			return profile;
		});
	}

	getSteamProfile() {
		if (this.steamProfile) {
			return Promise.resolve(this.steamProfile);
		}

		return steam.getUserProfile(this.steamIds[0]).then((profile) => {
			if (!profile) {
				return null;
			}

			this.steamProfile = profile;
			return profile;
		});
	}
}
