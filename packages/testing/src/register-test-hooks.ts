import { quit } from "@gtkx/ffi";
import { quit as unmountAllReconcilerRoots } from "@gtkx/react";
import { cleanup } from "./render.js";
import { callRunnerHook } from "./runner-hooks.js";

const flushPendingWork = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const teardownRuntime = async (): Promise<void> => {
    unmountAllReconcilerRoots();
    await flushPendingWork();
    quit();
};

const registerTestRuntimeHooks = (): void => {
    callRunnerHook("afterEach", cleanup);
    callRunnerHook("afterAll", teardownRuntime);
};

registerTestRuntimeHooks();
