type DevToolsInjectable = {
    injectIntoDevTools: (...args: never[]) => unknown;
};

const injection = { isDone: false };

const hasDevToolsHook = (): boolean => Reflect.get(globalThis, "__REACT_DEVTOOLS_GLOBAL_HOOK__") !== undefined;

const injectIntoDevTools = (reconciler: DevToolsInjectable): void => {
    if (injection.isDone || !hasDevToolsHook()) {
        return;
    }

    injection.isDone = true;
    reconciler.injectIntoDevTools();
};

export { injectIntoDevTools };
