import type {
	Collections,
	FileNameString,
	RecordIdString,
	UsersResponse,
	UsersRoleOptions
} from '$core/pocketbase/types';
import { steam, type SteamPlayerSummary } from '$core/steam';
import { relic } from '$lib/relic';
import type { RelicProfile } from '@fknoobs/app';
import { Context } from 'runed';

const userContext = new Context<UserContext>('<user />');
export const createUser = (user: () => UsersResponse) => userContext.set(new UserContext(user));
export const useUser = () => userContext.get();

export class UserContext {
	#user: () => UsersResponse;

	relicProfile = $state<RelicProfile>();
	steamProfile = $state<SteamPlayerSummary>();

	constructor(user: () => UsersResponse) {
		this.#user = user;
	}

	get id(): RecordIdString | undefined {
		return this.#user().id;
	}

	get collectionId(): string | undefined {
		return this.#user().collectionId;
	}

	get collectionName(): Collections | undefined {
		return this.#user().collectionName;
	}

	get avatar(): FileNameString | undefined {
		return this.#user().avatar;
	}

	get name(): string | undefined {
		return this.#user().name;
	}

	get email(): string | undefined {
		return this.#user().email;
	}

	get steamIds(): string[] {
		const ids = this.#user().steamIds;
		return Array.isArray(ids) ? ids.map(String) : [];
	}

	get created(): Date {
		return new Date(this.#user().created);
	}

	get updated(): Date {
		return new Date(this.#user().updated);
	}

	get role(): UsersRoleOptions | undefined {
		return this.#user().role;
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
