import type { WatchedChange } from "../dev/change-queue.js";
import type { DevServer, DevServerModule } from "../dev/vite-dev-server.js";
import { withExclusiveLoad } from "../internal/module-loads.js";
import {
    discoverStorybookFiles,
    isStorybookConfigCandidate,
    parseStorybookConfig,
    resolveStorybookConfigPath,
    type StorybookFiles,
} from "./config.js";

type StorySource = { id: string; title: string; load: () => Promise<unknown> };

type StorybookHandle = {
    updateStories: (sources: StorySource[], preview?: unknown) => Promise<void>;
    reportStorybookError: (cause: unknown) => void;
};

type StorybookSession = {
    initialize: () => Promise<void>;
    handleChange: (change: WatchedChange) => Promise<boolean>;
};

type StorybookState = {
    server: DevServer;
    handle: StorybookHandle;
    configured: string | undefined;
    files: StorybookFiles;
    modules: Map<string, Promise<Record<string, unknown>>>;
    hasFailedLoad: boolean;
    isRefreshBoundary: (module: Record<string, unknown>) => boolean;
};

const explorerHandle = (module: Record<string, unknown>): StorybookHandle => {
    if (typeof module.updateStories !== "function" || typeof module.reportStorybookError !== "function") {
        throw new TypeError("Storybook entry did not expose its development interface");
    }

    return module as StorybookHandle;
};

const invalidate = (server: DevServer, path: string): void => {
    const module = server.moduleGraph.getModuleById(path);

    if (module !== undefined) {
        server.moduleGraph.invalidateModule(module);
    }
};

const loadModule = (state: StorybookState, path: string): Promise<Record<string, unknown>> =>
    state.modules.getOrInsertComputed(path, () => state.server.ssrLoadModule(path));

const pruneModules = (state: StorybookState): void => {
    const paths = new Set([
        state.files.configPath,
        state.files.previewPath,
        ...state.files.stories.map(({ id }) => id),
    ]);

    for (const path of state.modules.keys()) {
        if (!paths.has(path)) {
            state.modules.delete(path);
        }
    }
};

const loadFiles = async (state: StorybookState): Promise<void> => {
    const { server } = state;
    const root = server.config.root;
    const configPath = resolveStorybookConfigPath(root, state.configured);
    const configModule = configPath === undefined ? undefined : await loadModule(state, configPath);
    const config = parseStorybookConfig(configModule?.default ?? (configPath === undefined ? {} : undefined));
    state.files = discoverStorybookFiles(root, configPath, config);
    pruneModules(state);
    const previewModule = state.files.previewPath === undefined
        ? undefined
        : await loadModule(state, state.files.previewPath);
    const preview = previewModule?.default;

    if (previewModule !== undefined && (typeof preview !== "object" || preview === null || Array.isArray(preview))) {
        throw new TypeError("Storybook preview must export an object");
    }

    await state.handle.updateStories(state.files.stories.map(({ id, title }) => ({
        id,
        title,
        load: () => loadModule(state, id),
    })), preview);
};

const invalidateFailedLoad = (state: StorybookState): void => {
    if (!state.hasFailedLoad) {
        return;
    }

    for (const path of state.modules.keys()) {
        invalidate(state.server, path);
    }

    state.modules.clear();
};

const invalidateChangedModules = (state: StorybookState, changedPath: string): void => {
    const paths = state.modules.keys().filter((path) =>
        path === changedPath || hasDependency(state, changedPath, new Set([path])),
    ).toArray();
    invalidate(state.server, changedPath);

    for (const path of paths) {
        state.modules.delete(path);
        invalidate(state.server, path);
    }
};

const reload = async (state: StorybookState, changedPath?: string): Promise<void> => {
    try {
        await withExclusiveLoad(state.server, async () => {
            if (changedPath !== undefined) {
                invalidateChangedModules(state, changedPath);
            }

            invalidateFailedLoad(state);
            await loadFiles(state);
        });
        state.hasFailedLoad = false;
    } catch (error) {
        state.hasFailedLoad = true;
        if (error instanceof Error) {
            state.server.ssrFixStacktrace(error);
        }

        state.handle.reportStorybookError(error);
    }
};

const hasImporter = (
    module: DevServerModule,
    targets: Set<string>,
    seen: Set<DevServerModule>,
): boolean => {
    if (seen.has(module)) {
        return false;
    }

    seen.add(module);

    if (module.id !== undefined && module.id !== null && targets.has(module.id)) {
        return true;
    }

    return [...(module.importers ?? [])].some((importer) => hasImporter(importer, targets, seen));
};

const hasDependency = (state: StorybookState, path: string, targets: Set<string>): boolean => {
    const module = state.server.moduleGraph.getModuleById(path);

    return module !== undefined && hasImporter(module, targets, new Set());
};

const shouldReload = (state: StorybookState, change: WatchedChange): boolean => {
    const { path, event } = change;
    const { files, server } = state;
    const configuration = [files.configPath, files.previewPath].filter((entry): entry is string =>
        entry !== undefined,
    );
    const configurationPaths = new Set(configuration);

    if (
        event !== "change" || configurationPaths.has(path) ||
        isStorybookConfigCandidate(server.config.root, path) || hasDependency(state, path, configurationPaths)
    ) {
        return true;
    }

    const stories = new Set(files.stories.map(({ id }) => id));

    if (stories.has(path)) {
        return true;
    }

    const module = server.moduleGraph.getModuleById(path);

    return hasDependency(state, path, stories) &&
        (module?.ssrModule === undefined || module.ssrModule === null || !state.isRefreshBoundary(module.ssrModule));
};

const createStorybookSession = (
    server: DevServer,
    entry: Record<string, unknown>,
    configured: string,
    isRefreshBoundary: (module: Record<string, unknown>) => boolean,
): StorybookSession => {
    const state: StorybookState = {
        server,
        handle: explorerHandle(entry),
        configured: configured === "" ? undefined : configured,
        files: { configPath: undefined, previewPath: undefined, stories: [] },
        modules: new Map(),
        hasFailedLoad: false,
        isRefreshBoundary,
    };

    return {
        initialize: () => reload(state),
        handleChange: async (change) => {
            if (!shouldReload(state, change)) {
                return false;
            }

            await reload(state, change.path);

            return true;
        },
    };
};

export { createStorybookSession, type StorybookSession };
