import { afterAll, afterEach, beforeAll } from "vitest";
import { start, stop } from "./lifecycle.js";

afterEach(() => {
    if (global.gc) {
        global.gc();
    }
});

beforeAll(() => {
    start();
});

afterAll(() => {
    stop();
});
