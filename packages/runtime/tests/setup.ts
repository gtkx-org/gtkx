import { afterAll, afterEach, beforeAll } from "vitest";

const collectGarbage = (): void => {
    if (globalThis.gc) {
        globalThis.gc();
    }
};

beforeAll(async () => {
    const { init } = await import("@gtkx/gi/gtk");
    init();
    await import("@gtkx/runtime");
});

afterEach(collectGarbage);

afterAll(async () => {
    const { quit } = await import("@gtkx/runtime");
    quit();
});
