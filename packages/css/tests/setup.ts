import { start, stop } from "@gtkx/ffi";
import { afterAll, beforeAll } from "vitest";

const APP_ID = `com.gtkx.css.test${process.pid}`;

beforeAll(() => {
    start(APP_ID);
});

afterAll(() => {
    stop();
});
