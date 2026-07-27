import { quit } from "@gtkx/runtime";
import { registerMatchers } from "./matchers.js";
import { cleanup } from "./render.js";

const callRunnerHook = (name: "afterEach" | "afterAll", callback: () => unknown): void => {
    const hook: unknown = Reflect.get(globalThis, name);

    if (typeof hook === "function") {
        (hook as (callback: () => unknown) => void)(callback);
    }
};

const registerTestRuntimeHooks = (): void => {
    callRunnerHook("afterEach", cleanup);
    callRunnerHook("afterAll", quit);
    registerMatchers();
};

registerTestRuntimeHooks();
