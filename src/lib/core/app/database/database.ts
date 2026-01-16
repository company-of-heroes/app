import { Matches } from './matches';
import { Replays } from './replays';
import { ChatRooms } from './chat-rooms';

export class Database {
	public matches = new Matches();
	public chatRooms = new ChatRooms();
	public replays = new Replays();
}

export const database = new Database();
