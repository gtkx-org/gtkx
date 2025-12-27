import EventEmitter from "node:events";

type NativeEventMap = {
    start: [];
    stop: [];
};

export const events = new EventEmitter<NativeEventMap>();
