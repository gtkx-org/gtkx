import { afterEach } from "vitest";

afterEach(() => {
    if (global.gc) {
        global.gc();
    }
});
