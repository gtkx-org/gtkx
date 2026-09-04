import { createJiti, type Jiti, type TransformOptions, type TransformResult } from "jiti";
import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire, registerHooks } from "node:module";
import { extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

type CaptureState = { cacheKey: string; dependencies: Set<string>; transformer: Jiti };
type CapturedConfig<T> = { dependencies: string[]; value: T };

const captureStorage: AsyncLocalStorage<CaptureState> = new AsyncLocalStorage();
const dependenciesByValue: WeakMap<object, string[]> = new WeakMap();
const CACHE_BUSTED_EXTENSIONS: ReadonlySet<string> = new Set([".cjs", ".js", ".json", ".mjs"]);

const isTrackedPath = (path: string): boolean => !path.includes(`${sep}node_modules${sep}`);

const addPath = (path: string): void => {
    if (isTrackedPath(path)) {
        captureStorage.getStore()?.dependencies.add(path);
    }
};

const addUrl = (url: string): void => {
    if (url.startsWith("file:")) {
        addPath(fileURLToPath(url));
    }
};

const cacheBustedUrl = (url: string): string => {
    if (!url.startsWith("file:")) {
        return url;
    }

    const path = fileURLToPath(url);

    if (!isTrackedPath(path) || !CACHE_BUSTED_EXTENSIONS.has(extname(path))) {
        return url;
    }

    const parsed = new URL(url);
    parsed.searchParams.set("gtkx-config-load", captureStorage.getStore()?.cacheKey ?? "uncaptured");

    return parsed.href;
};

const registerResolutionHook = (): ReturnType<typeof registerHooks> =>
    registerHooks({
        resolve(specifier, context, nextResolve) {
            const result = nextResolve(specifier, context);
            addUrl(result.url);

            return { ...result, url: cacheBustedUrl(result.url) };
        },
    });

const clearNativeModuleCache = (dependencies: Iterable<string>): void => {
    const cache = createRequire(import.meta.url).cache;

    for (const path of dependencies) {
        Reflect.deleteProperty(cache, path);
    }
};

const transformConfigModule = (options: TransformOptions): TransformResult => {
    const state = captureStorage.getStore();

    if (state === undefined) {
        throw new Error("Configuration transformation started outside a dependency capture");
    }

    if (options.filename !== undefined) {
        addPath(options.filename);
    }

    return { code: state.transformer.transform(options) };
};

const setConfigDependencies = (value: object, dependencies: Iterable<string>): void => {
    const paths = [...new Set(dependencies)];
    dependenciesByValue.set(value, paths);
    clearNativeModuleCache(paths);
};

const configDependenciesFor = (value: unknown): string[] =>
    typeof value === "object" && value !== null ? dependenciesByValue.get(value) ?? [] : [];

const captureConfigDependencies = async <T>(operation: () => Promise<T>): Promise<CapturedConfig<T>> => {
    const state: CaptureState = {
        cacheKey: process.hrtime.bigint().toString(),
        dependencies: new Set(),
        transformer: createJiti(import.meta.url, { fsCache: false, moduleCache: false }),
    };
    const hook = registerResolutionHook();

    try {
        const value = await captureStorage.run(state, operation);

        return { dependencies: [...state.dependencies], value };
    } catch (error) {
        if (typeof error === "object" && error !== null) {
            setConfigDependencies(error, state.dependencies);
        }

        throw error;
    } finally {
        hook.deregister();
    }
};

export {
    captureConfigDependencies,
    configDependenciesFor,
    setConfigDependencies,
    transformConfigModule,
};
