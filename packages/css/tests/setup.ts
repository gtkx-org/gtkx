import { start, stop } from "@gtkx/ffi";
import { afterAll, beforeAll } from "vitest";

const toAppId = (name: string) => {
    return `com.gtkx.${name.replace(/[^a-zA-Z0-9]/g, "_")}`;
};

beforeAll((context) => {
    start(toAppId(context.name));
});

afterAll(() => {
    stop();
});
