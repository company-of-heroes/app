import { Matches } from './matches';
import { Comments } from './comments';
import { Replays } from './replays';
import { ChatRooms } from './chat-rooms';
import { LobbiesLive } from './lobbies-live';

export class Database {
	public matches = new Matches();
	public chatRooms = new ChatRooms();
	public replays = new Replays();
	public comments = new Comments();
    public lobbiesLive = new LobbiesLive();
}

export const database = new Database();
