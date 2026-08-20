import { afterAll, afterEach, beforeAll } from "vitest";

const collectGarbage = (): void => {
    if (globalThis.gc) {
        globalThis.gc();
    }
};

beforeAll(async () => {
    await import("@gtkx/runtime");
});

afterEach(collectGarbage);

afterAll(async () => {
    const { quit } = await import("@gtkx/runtime");
    quit();
});
