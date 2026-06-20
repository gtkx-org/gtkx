import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { CodegenRunner } from "@gtkx/codegen";
import {
    type GtkxConfig,
    GtkxConfigNotFoundError,
    loadGtkxConfig,
    resolveDataDir,
    type UserTableRows,
} from "@gtkx/config";
import { emitSchemaEnv } from "../gsettings/env.js";
import { info } from "../internal/log.js";
import { isCodegenNeeded } from "./freshness.js";
import { resolveGirPath } from "./gir-resolver.js";
import { resolveLibraries } from "./library-resolver.js";
import {
    type CodegenStore,
    findCodegenRoot,
    isWorkspaceRoot,
    resolveCodegenContext,
    resolveCodegenStore,
} from "./store-resolver.js";

/**
 * Options for {@link runCodegen}.
 */
export type RunCodegenOptions = {
    /** Project root in which to look for `gtkx.config.ts`. Defaults to `process.cwd()`. */
    cwd?: string;
    /**
     * When true, remove the entire generated store and aliases before
     * regenerating, for a guaranteed-fresh tree — the `--force` escape hatch
     * for a corrupted store.
     */
    force?: boolean;
};

/**
 * Result of a codegen invocation.
 */
export type RunCodegenResult = {
    /** Number of namespaces processed. */
    namespaces: number;
    /** Number of widgets metadata-collected for React. */
    widgets: number;
    /** Wall-clock duration in milliseconds. */
    duration: number;
    /** Resolved GIR search path used by the run. */
    girPath?: string[];
    /** Path of the loaded `gtkx.config.ts`, when one was used. */
    configFile?: string;
    /**
     * Concrete GIR namespace identifiers generated this run, after applying
     * the `libraries` default and expanding `"*"`. Absent when cached.
     */
    libraries?: string[];
};

const tableRows = (config: GtkxConfig): UserTableRows => {
    const { containerProps, arrayProps, objectProps, virtualProps, elementMap } = config;
    return { containerProps, arrayProps, objectProps, virtualProps, elementMap };
};

const buildRunner = (
    store: CodegenStore,
    libraries: readonly string[],
    girPath: readonly string[],
    config: GtkxConfig,
): CodegenRunner =>
    new CodegenRunner({
        libraries,
        girPath,
        ...tableRows(config),
        gi: {
            storeDir: store.giStoreDir,
            linkDir: store.giLinkDir,
            realFfiDir: store.realFfiDir,
            realNativeDir: store.realNativeDir,
            version: store.ffiVersion,
        },
        jsx:
            store.react !== null && store.realReactRuntimeDir !== null
                ? {
                      storeDir: store.jsxStoreDir,
                      linkDir: store.jsxLinkDir,
                      giStoreDir: store.giStoreDir,
                      realReactRuntimeDir: store.realReactRuntimeDir,
                      realReactPackageDir: store.react.realDir,
                      version: store.react.version,
                  }
                : undefined,
    });

/**
 * Runs the codegen pipeline end-to-end against a user project.
 *
 * Loads `gtkx.config.ts`, resolves GIR search paths and the resolved library
 * list, locates the project's installed `@gtkx/ffi`/`@gtkx/react`, and delegates
 * to {@link CodegenRunner}, which materializes the injected `@gtkx/gi` (and,
 * when React is present, `@gtkx/jsx`) packages into `node_modules`.
 *
 * Always regenerates: the conditional {@link ensureGenerated} gate (used by the
 * turbo task and the `gtkx dev`/`gtkx build` preflight) owns the decision of
 * whether to invoke codegen at all. With {@link RunCodegenOptions.force}, the
 * store and aliases are removed first.
 *
 * @param options - {@link RunCodegenOptions}
 * @returns Summary of work performed, plus the resolved config and GIR path
 */
export const runCodegen = async (options: RunCodegenOptions = {}): Promise<RunCodegenResult> => {
    const cwd = findCodegenRoot(options.cwd ?? process.cwd());

    const { config, configFile } = await loadGtkxConfig(cwd);

    const girPath = resolveGirPath(config.girPath);
    const libraries = resolveLibraries(config.libraries, girPath);

    const store = resolveCodegenStore(cwd);

    if (girPath.length === 0) {
        throw new Error(
            "No GIR search paths available. Install gobject-introspection (Linux: `sudo dnf install gobject-introspection-devel` or `sudo apt install libgirepository1.0-dev`), or set `girPath` in gtkx.config.ts.",
        );
    }

    if (options.force) {
        for (const path of [store.giStoreDir, store.giLinkDir, store.jsxStoreDir, store.jsxLinkDir]) {
            rmSync(path, { recursive: true, force: true });
        }
    }

    const result = await buildRunner(store, libraries, girPath, config).run();

    return {
        namespaces: result.namespaces,
        widgets: result.widgets,
        duration: result.duration,
        girPath,
        configFile,
        libraries,
    };
};

/**
 * Regenerates the project's GSettings schema declaration file
 * (`node_modules/.gtkx/env.d.ts`) for an app package root.
 *
 * Workspace roots are skipped: the schema declarations are app-local (each
 * member's schemas type that member's imports), so emission only applies to
 * the package the command runs in.
 *
 * @param cwd - The app package root
 */
export const syncSchemaEnv = (cwd: string): void => {
    if (isWorkspaceRoot(cwd)) return;
    emitSchemaEnv(cwd, resolveDataDir(cwd));
};

/**
 * Regenerates the injected packages when any required module or alias is
 * missing, leaving them untouched otherwise.
 *
 * The injected packages are a generated artifact that the build system does not
 * track, so a cache-restored build can be present without them. The
 * `gtkx dev`/`gtkx build` flows and the `@gtkx/cli#codegen` turbo task call this
 * first so generation is coupled to the build graph.
 *
 * @param cwd - Project root in which to look for `gtkx.config.ts`
 */
export const ensureGenerated = async (cwd: string): Promise<boolean> => {
    const context = await resolveCodegenContext(cwd);
    if (!context) {
        return false;
    }
    syncSchemaEnv(cwd);
    if (!isCodegenNeeded(context.root, context.config)) {
        return false;
    }
    await runCodegen({ cwd: context.root });
    return true;
};

/**
 * Best-effort preflight for `gtkx dev` and `gtkx build`.
 *
 * Runs codegen if a `gtkx.config.ts` is present and a required generated module
 * or alias is missing. Returns silently when `GTKX_DISABLE_PREFLIGHT=1` is set
 * or no `gtkx.config.ts` exists.
 *
 * @param cwd - Project root
 */
export const preflightCodegen = async (cwd: string): Promise<void> => {
    if (process.env.GTKX_DISABLE_PREFLIGHT === "1") {
        return;
    }

    const context = await resolveCodegenContext(cwd);
    if (!context) {
        return;
    }
    syncSchemaEnv(cwd);
    if (isCodegenNeeded(context.root, context.config)) {
        info("generated bindings missing; running codegen...");
        await runCodegen({ cwd: context.root });
    }
};

/**
 * Resolves the `gtkx dev` config watch: the project's `gtkx.config.ts` path and
 * a regenerate hook that re-runs codegen against its codegen root.
 *
 * A `libraries` (or any) edit to `gtkx.config.ts` thus regenerates the bindings
 * and restarts the supervised runner. Returns `undefined` when no
 * `gtkx.config.ts` is present, so `gtkx dev` simply runs without config-driven
 * regeneration. The shape matches the supervisor's `DevWatch`.
 *
 * @param cwd - Project root passed to `gtkx dev`
 */
export const resolveConfigWatch = async (
    cwd: string,
): Promise<{ readonly paths: readonly string[]; readonly regenerate: () => Promise<void> } | undefined> => {
    const root = findCodegenRoot(cwd);
    try {
        const { configFile, rootDir } = await loadGtkxConfig(root);
        if (configFile === undefined) return undefined;
        return {
            paths: [resolve(rootDir, configFile)],
            regenerate: async () => {
                await runCodegen({ cwd: root });
            },
        };
    } catch (error) {
        if (error instanceof GtkxConfigNotFoundError) return undefined;
        throw error;
    }
};
