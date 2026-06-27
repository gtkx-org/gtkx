import { quit } from "@gtkx/ffi";
import { cleanup } from "./render.js";

const callRunnerHook = (name: "afterEach" | "afterAll", callback: () => unknown): void => {
    const hook: unknown = Reflect.get(globalThis, name);
    if (typeof hook === "function") (hook as (callback: () => unknown) => void)(callback);
};

/**
 * Wires the gtkx test lifecycle to the runner's global hooks so consuming suites
 * need no teardown boilerplate: `afterEach` disposes every rendered tree, and
 * `afterAll` quits the single GLib runtime once per worker — before the worker's
 * headless display is torn down, so the GLib thread is never dispatching a dead
 * Wayland connection. Probes the globals instead of importing the runner, so the
 * harness stays runner-agnostic and is inert when no global hooks are present.
 */
const registerTestRuntimeHooks = (): void => {
    callRunnerHook("afterEach", cleanup);
    callRunnerHook("afterAll", quit);
};

registerTestRuntimeHooks();
