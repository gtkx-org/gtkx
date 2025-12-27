import { type Arg, batchCall, type CallDescriptor, call as nativeCall, type Type } from "@gtkx/native";

const batchStack: CallDescriptor[][] = [];

export const beginBatch = (): void => {
    batchStack.push([]);
};

export const isBatching = (): boolean => {
    return batchStack.length > 0;
};

export const endBatch = (): void => {
    const queue = batchStack.pop();
    if (!queue) return;

    if (queue.length > 0) {
        batchCall(queue);
    }
};

export const call = (library: string, symbol: string, args: Arg[], returnType: Type): unknown => {
    const currentQueue = batchStack[batchStack.length - 1];

    if (currentQueue && returnType.type === "undefined") {
        currentQueue.push({ library, symbol, args });
        return undefined;
    }

    return nativeCall(library, symbol, args, returnType);
};

export const batch = <T extends (...args: unknown[]) => unknown>(fn: T): ReturnType<T> => {
    beginBatch();

    try {
        return fn() as ReturnType<T>;
    } finally {
        endBatch();
    }
};
