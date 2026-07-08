import { Matches } from './matches';
import { Replays } from './replays';
import { LobbiesLive } from './lobbies-live';
import { Notifications } from './notifications';

export class Database {
	public matches = new Matches();
	public replays = new Replays();
	public lobbiesLive = new LobbiesLive();
	public notifications = new Notifications();
}

export const database = new Database();
