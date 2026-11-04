import { quit } from "@gtkx/runtime";
import { afterAll, afterEach } from "vitest";

const collectGarbage = (): void => {
    if (globalThis.gc) {
        globalThis.gc();
    }
};

afterEach(collectGarbage);

afterAll(quit);
