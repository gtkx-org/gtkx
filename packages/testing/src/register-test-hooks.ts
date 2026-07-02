import { quit } from "@gtkx/ffi";
import { cleanup } from "./render.js";
import { callRunnerHook } from "./runner-hooks.js";

const registerTestRuntimeHooks = (): void => {
    callRunnerHook("afterEach", cleanup);
    callRunnerHook("afterAll", quit);
};

registerTestRuntimeHooks();
