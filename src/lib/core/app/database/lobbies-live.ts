import type { Match } from "../context/lobby.svelte";
import { fetch } from "@tauri-apps/plugin-http";
import { exp, pocketbase } from '$core/pocketbase';
import { auth } from "../features/auth";

export class LobbiesLive {
    setLobby(match: Match) {
        pocketbase.collection('lobbies_live')
            .getFirstListItem('', { fetch })
            .then(existingLobby => {
                pocketbase.collection('lobbies_live').update(existingLobby.id, {
                    user: auth.userId,
                    isRanked: match.isRanked,
                    sessionId: match.sessionId,
                    map: match.map,
                    players: match.players,
                }, { fetch })
                .then(lobby => console.log(lobby))
            })
            .catch(() => {
                pocketbase.collection('lobbies_live').create({
                    user: auth.userId,
                    isRanked: match.isRanked,
                    sessionId: match.sessionId,
                    map: match.map,
                    players: match.players,
                }, { fetch })
                .then(lobby => console.log(lobby)) 
            })
    }
}