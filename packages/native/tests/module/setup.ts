import { afterAll, afterEach, beforeAll } from "vitest";
import { start, stop } from "../../index.js";

afterEach(() => {
    if (global.gc) {
        global.gc();
    }
});

const toAppId = (name: string) => {
    return `com.gtkx.${name.replace(/[^a-zA-Z0-9]/g, "_")}`;
};

beforeAll((context) => {
    start(toAppId(context.name));
});

afterAll(() => {
    stop();
});
