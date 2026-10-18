import { createJiti, type Jiti } from "jiti";
import { AsyncLocalStorage } from "node:async_hooks";
import { registerHooks } from "node:module";
import { extname, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isRecord } from "./config-error.ts";
import { configSourceCandidates } from "./config-source.ts";

type CaptureState = { cacheKey: string; dependencies: Set<string>; resolver: Jiti };
type CapturedConfig<T> = { dependencies: string[]; value: T };

const captureStorage: AsyncLocalStorage<CaptureState> = new AsyncLocalStorage();
const dependenciesByValue: WeakMap<object, string[]> = new WeakMap();
const CACHE_BUSTED_EXTENSIONS: ReadonlySet<string> = new Set([".js", ".json", ".mjs", ".mts", ".ts"]);

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

const addConfigSource = (path: string): void => {
    for (const candidate of configSourceCandidates(path)) {
        addPath(candidate);
    }
};

const addFailedSource = (error: unknown): void => {
    if (isRecord(error) && typeof error.url === "string" && error.url.startsWith("file:")) {
        addConfigSource(fileURLToPath(error.url));
    }
};

const cacheBustedUrl = (url: string): string => {
    const state = captureStorage.getStore();

    if (state === undefined || !url.startsWith("file:")) {
        return url;
    }

    const path = fileURLToPath(url);

    if (!isTrackedPath(path) || !CACHE_BUSTED_EXTENSIONS.has(extname(path))) {
        return url;
    }

    const parsed = new URL(url);
    parsed.searchParams.set("gtkx-config-load", state.cacheKey);

    return parsed.href;
};

const registerResolutionHook = (): ReturnType<typeof registerHooks> =>
    registerHooks({
        resolve(specifier, context, nextResolve) {
            let result;

            try {
                result = nextResolve(specifier, context);
            } catch (error) {
                const state = captureStorage.getStore();
                const fallback = captureStorage.exit(() =>
                    state?.resolver.esmResolve(specifier, {
                        ...(context.parentURL !== undefined && { parentURL: context.parentURL }),
                        try: true,
                    }),
                );

                if (fallback === undefined) {
                    addFailedSource(error);
                    throw error;
                }

                result = nextResolve(fallback, context);
            }

            addUrl(result.url);

            return { ...result, url: cacheBustedUrl(result.url) };
        },
    });

const importConfigModule: Jiti["import"] = async <T>(path: string, options?: { default?: true }): Promise<T> => {
    if ([".cjs", ".cts"].includes(extname(path))) {
        throw new Error(`Configuration modules must use ESM: ${path}`);
    }

    const value = (await import(pathToFileURL(path).href, {
        ...(extname(path) === ".json" && { with: { type: "json" } }),
    })) as Record<string, unknown>;

    return (options?.default ? (value.default ?? { ...value }) : value) as T;
};

const createConfigImporter = (): Jiti =>
    Object.assign(createJiti(import.meta.url, { fsCache: false, moduleCache: false }), { import: importConfigModule });

const setConfigDependencies = (value: object, dependencies: Iterable<string>): void => {
    const paths = [...new Set(dependencies)];
    dependenciesByValue.set(value, paths);
};

const configDependenciesFor = (value: unknown): string[] =>
    typeof value === "object" && value !== null ? (dependenciesByValue.get(value) ?? []) : [];

const captureConfigDependencies = async <T>(operation: () => Promise<T>): Promise<CapturedConfig<T>> => {
    const state: CaptureState = {
        cacheKey: process.hrtime.bigint().toString(),
        dependencies: new Set(),
        resolver: createJiti(import.meta.url, { fsCache: false, moduleCache: false }),
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

const loadConfigModule = async (path: string): Promise<unknown> => {
    const captured = await captureConfigDependencies(() => importConfigModule(path, { default: true }));

    return captured.value;
};

export {
    addConfigSource,
    captureConfigDependencies,
    configDependenciesFor,
    createConfigImporter,
    loadConfigModule,
    setConfigDependencies,
};
