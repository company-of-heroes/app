import { EventEmitter } from "eventemitter3";

export class Events<T extends EventEmitter.ValidEventTypes> extends EventEmitter<T> {}