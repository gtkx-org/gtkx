import { call } from "../native.js";
import { INT_TYPE, LIB } from "./common.js";

export const cairoVersion = (): number => {
    return call(LIB, "cairo_version", [], INT_TYPE) as number;
};

export const cairoVersionString = (): string => {
    return call(LIB, "cairo_version_string", [], { type: "string", ownership: "borrowed" }) as string;
};
