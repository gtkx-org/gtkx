import { quit } from "@gtkx/ffi";
import { quit as unmountAllReconcilerRoots } from "@gtkx/react";
import { cleanup } from "./render.js";

export const callRunnerHook = (name: "afterEach" | "afterAll", callback: () => unknown): void => {
    const hook: unknown = Reflect.get(globalThis, name);
    if (typeof hook === "function") (hook as (callback: () => unknown) => void)(callback);
};

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
