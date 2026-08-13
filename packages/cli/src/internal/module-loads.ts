type ModuleLoader = {
    ssrLoadModule(id: string): Promise<Record<string, unknown>>;
};

const loadChains: WeakMap<object, Promise<void>> = new WeakMap();

const settled = async (load: Promise<unknown>): Promise<void> => {
    try {
        await load;
    } catch {
        return;
    }
};

const withExclusiveLoad = <T>(server: object, run: () => Promise<T>): Promise<T> => {
    const pending = loadChains.get(server) ?? Promise.resolve();

    const result = (async (): Promise<T> => {
        await pending;

        return run();
    })();

    loadChains.set(server, settled(result));

    return result;
};

const loadModuleExclusively = (server: ModuleLoader, id: string): Promise<Record<string, unknown>> =>
    withExclusiveLoad(server, () => server.ssrLoadModule(id));

export { loadModuleExclusively, withExclusiveLoad };
