import { Matches } from './matches';
import { Replays } from './replays';
import { ChatRooms } from './chat-rooms';
import { Matches2 } from './matches2';

export class Database {
	public matches = new Matches();
	public matches2 = new Matches2();
	public chatRooms = new ChatRooms();
	public replays = new Replays();
}

export const database = new Database();
