import { afterAll, afterEach, beforeAll } from "vitest";
import { callArgs, GTK_LIB } from "./helpers/native-utils.js";

const collectGarbage = (): void => {
    if (globalThis.gc) {
        globalThis.gc();
    }
};

beforeAll(async () => {
    await import("@gtkx/runtime");
    callArgs(GTK_LIB, "gtk_init", [], { kind: "void" });
});

afterEach(collectGarbage);

afterAll(async () => {
    const { quit } = await import("@gtkx/runtime");
    quit();
});
