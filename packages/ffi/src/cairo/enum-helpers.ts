import { createRef } from "@gtkx/native";
import { call, read } from "../native.js";
import { INT_TYPE, LIB } from "./common.js";

export function getEnumList<T extends number>(fnName: string): T[] {
    const versionsRef = createRef(null);
    const numRef = createRef(0);
    call(
        LIB,
        fnName,
        [
            {
                type: {
                    type: "ref",
                    innerType: { type: "boxed", innerType: "int*", library: LIB, ownership: "borrowed" },
                },
                value: versionsRef,
            },
            { type: { type: "ref", innerType: INT_TYPE }, value: numRef },
        ],
        { type: "undefined" },
    );
    const count = numRef.value as number;
    const result: T[] = [];
    for (let i = 0; i < count; i++) {
        result.push(read(versionsRef.value, INT_TYPE, i * 4) as T);
    }
    return result;
}

export function enumToString(fnName: string, value: number): string {
    return call(LIB, fnName, [{ type: INT_TYPE, value }], {
        type: "string",
        ownership: "borrowed",
    }) as string;
}
