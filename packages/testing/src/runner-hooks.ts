export const callRunnerHook = (name: "afterEach" | "afterAll", callback: () => unknown): void => {
    const hook: unknown = Reflect.get(globalThis, name);
    if (typeof hook === "function") (hook as (callback: () => unknown) => void)(callback);
};
