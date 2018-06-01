import * as net from "net";
import * as http from "http";
import * as https from "https";

import { Client, isValidId } from '..';
import { Protocol, decode, send } from "../Protocol";
import { MatchMaker } from '../MatchMaker';

import { debugError } from './../Debug';

export abstract class Transport {
    protected server: net.Server | http.Server | https.Server;
    protected matchMaker: MatchMaker;

    constructor (matchMaker: MatchMaker) {
        this.matchMaker = matchMaker;
    }

    abstract listen(port?: number, hostname?: string, backlog?: number, listeningListener?: Function): this;
    abstract shutdown(): void;

    protected onMessageMatchMaking(client: Client, message: any) {
        if (!message) {
            debugError(`couldn't decode message: ${message}`);
            return;
        }

        if (message[0] === Protocol.JOIN_ROOM) {
            const roomName = message[1];
            const joinOptions = message[2];

            joinOptions.clientId = client.id;

            if (!this.matchMaker.hasHandler(roomName) && !isValidId(roomName)) {
                send(client, [Protocol.JOIN_ERROR, roomName, `Error: no available handler for "${roomName}"`]);

            } else {
                this.matchMaker.onJoinRoomRequest(client, roomName, joinOptions).
                    then((roomId: string) => send(client, [Protocol.JOIN_ROOM, roomId, joinOptions.requestId])).
                    catch((e) => {
                        debugError(e.stack || e);
                        send(client, [Protocol.JOIN_ERROR, roomName, e && e.message]);
                    });
            }

        } else if (message[0] === Protocol.ROOM_LIST) {
            const requestId = message[1];
            const roomName = message[2];

            this.matchMaker.getAvailableRooms(roomName).
                then((rooms) => send(client, [Protocol.ROOM_LIST, requestId, rooms])).
                catch((e) => debugError(e.stack || e));

        } else {
            debugError(`MatchMaking couldn\'t process message: ${message}`);
        }

    }

}

export { TCPTransport } from "./TCPTransport";
export { WebSocketTransport } from "./WebSocketTransport";