import { t } from "@gtkx/ffi";
import { INT_TYPE, LIB, STRING_BORROWED } from "./common.js";

const { fn } = t;

const cairo_version = fn(LIB, "cairo_version", [], INT_TYPE);
const cairo_version_string = fn(LIB, "cairo_version_string", [], STRING_BORROWED);

export const cairoVersion = (): number => {
    return cairo_version() as number;
};

export const cairoVersionString = (): string => {
    return cairo_version_string() as string;
};
