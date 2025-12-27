import { createRequire } from "node:module";
import type { Arg, Ref, Type } from "./types.js";

const require = createRequire(import.meta.url);
const native = require("./index.node");

export function createRef<T>(value: T): Ref<T> {
    return { value };
}

export function call(library: string, symbol: string, args: Arg[], returnType: Type): unknown {
    return native.call(library, symbol, args, returnType);
}

export type CallDescriptor = {
    library: string;
    symbol: string;
    args: Arg[];
};

export function batchCall(calls: CallDescriptor[]): void {
    native.batchCall(calls);
}

export function start(appId: string, flags?: number): unknown {
    return native.start(appId, flags);
}

export function stop(): void {
    native.stop();
}

export function read(objectId: unknown, type: Type, offset: number): unknown {
    return native.read(objectId, type, offset);
}

export function write(objectId: unknown, type: Type, offset: number, value: unknown): void {
    native.write(objectId, type, offset, value);
}

export function alloc(size: number, glibTypeName: string, lib?: string): unknown {
    return native.alloc(size, glibTypeName, lib);
}

export function getObjectId(id: unknown): number {
    return native.getObjectId(id);
}

export function poll(): void {
    native.poll();
}

export type { Ref, Arg, Type };
