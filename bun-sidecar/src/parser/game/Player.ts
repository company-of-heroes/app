import type { IPlayer } from "../types.js";

export default class Player implements IPlayer {
    index: number;
    playerId: number;
    type: number;
    team: number;
    race: number;
    slot: number;
    steamId?: bigint;
    ranking?: number;
    result?: 'PS_WON'|'PS_KILLED'
}