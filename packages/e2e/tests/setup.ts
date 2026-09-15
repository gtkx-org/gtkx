import { afterEach } from "vitest";

const collectGarbage = (): void => {
    if (globalThis.gc) {
        globalThis.gc();
    }
};

process.env.GSETTINGS_BACKEND = "memory";
afterEach(collectGarbage);
