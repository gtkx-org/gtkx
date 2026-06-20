import type { InlineConfig, Plugin } from "vite";

/**
 * A module the runner invalidates. The runner only ever hands a module back to
 * {@link DevServerModuleGraph.invalidateModule}, so no members are required.
 */
type DevServerModule = object;

/**
 * The changed module the runner resolves from a path: it is invalidatable and
 * exposes the importing modules the runner cascades the invalidation to.
 */
type DevServerChangedModule = DevServerModule & {
    readonly importers: Iterable<DevServerModule>;
};

/**
 * The dev server's module graph, narrowed to the lookups and invalidations the
 * runner performs on a file change.
 */
type DevServerModuleGraph = {
    getModuleById(id: string): DevServerChangedModule | undefined;
    invalidateModule(module: DevServerModule): void;
};

/**
 * The dev server, narrowed to the members the runner uses. Vite's full
 * `ViteDevServer` is assignable to this, so production keeps passing the real
 * server while tests supply a structural double with no cast.
 */
export type DevServer = {
    close(): Promise<void>;
    moduleGraph: DevServerModuleGraph;
    ssrLoadModule(id: string): Promise<Record<string, unknown>>;
    watcher: {
        on(event: "change", listener: (changedPath: string) => void): void;
    };
};

/**
 * The dev server's inline Vite config. SSR externalizes every dependency so
 * the FFI runtime, the generated `@gtkx/gi` store, and the native module load
 * through Node under a single module identity — except the packages that
 * import `virtual:gtkx-config` or `@gtkx/react`: those run through Vite's
 * pipeline, where the `gtkx:config` plugin serves the virtual module and the
 * one transformed `@gtkx/react` instance is shared by app code, the generated
 * `@gtkx/jsx` modules, and `@gtkx/animate`.
 *
 * @param root - The project root the dev server runs in.
 * @param plugins - The gtkx Vite plugins to register.
 * @returns The inline config for the SSR dev server.
 */
export const buildConfig = (root: string, plugins: Plugin[]): InlineConfig => ({
    root,
    appType: "custom",
    plugins,
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { external: true, noExternal: [/^@gtkx\/(config|react|jsx|animate)(\/|$)/, /[/\\]\.gtkx[/\\]/] },
});
