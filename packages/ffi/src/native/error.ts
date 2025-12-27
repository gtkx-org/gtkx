import { read } from "@gtkx/native";

export class NativeError extends Error {

    readonly id: unknown;

    readonly domain: number;

    readonly code: number;

    constructor(id: unknown) {
        const message = read(id, { type: "string" }, 8) as string;
        super(message ?? "Unknown error");

        this.id = id;
        this.domain = read(id, { type: "int", size: 32, unsigned: true }, 0) as number;
        this.code = read(id, { type: "int", size: 32, unsigned: false }, 4) as number;

        this.name = "NativeError";

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, NativeError);
        }
    }
}
