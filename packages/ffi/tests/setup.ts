import { afterAll, beforeAll } from "vitest";

beforeAll(async () => {
    await import("@gtkx/ffi");
});

afterAll(async () => {
    const { quit } = await import("@gtkx/ffi");
    quit();
});
