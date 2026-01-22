import { type Arg, call as nativeCall, type Type } from "@gtkx/native";
import { getStartError } from "./native/lifecycle.js";

export const call = (library: string, symbol: string, args: Arg[], returnType: Type): unknown => {
    const startError = getStartError();
    if (startError) {
        throw new Error(`[gtkx] ${startError} (attempted call: ${library}:${symbol})`);
    }

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg?.value === undefined && !arg?.optional) {
            const err = new Error(`[gtkx] Undefined value in FFI call: ${library}:${symbol} arg[${i}]`);
            console.error(err.message, { arg, args });
            console.error(err.stack);
            throw err;
        }
    }

    return nativeCall(library, symbol, args, returnType);
};
