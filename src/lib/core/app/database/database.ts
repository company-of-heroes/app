import { Matches } from './lobbies';
import { Replays } from './replays';
import { ChatRooms } from './chat-rooms';

export class Database {
	public matches = new Matches();
	public chatRooms = new ChatRooms();
	public replays = new Replays();
}

export const database = new Database();
