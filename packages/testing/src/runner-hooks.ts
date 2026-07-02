/**
 * Registers a callback with the ambient test-runner lifecycle hook of the given
 * name when one is present on `globalThis`.
 *
 * The hook (`afterEach` or `afterAll`) is resolved dynamically so that modules
 * loaded before the runner installs its globals, or outside of a runner
 * entirely, degrade to a no-op instead of throwing.
 *
 * @param name - The lifecycle hook to target.
 * @param callback - The callback to register with that hook.
 */
export const callRunnerHook = (name: "afterEach" | "afterAll", callback: () => unknown): void => {
    const hook: unknown = Reflect.get(globalThis, name);
    if (typeof hook === "function") (hook as (callback: () => unknown) => void)(callback);
};
