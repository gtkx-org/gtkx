import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { CodegenRunner } from "@gtkx/codegen";
import type { GtkxConfig } from "../config.js";
import { GtkxConfigNotFoundError, loadGtkxConfig } from "./config-loader.js";
import { resolveGirPath } from "./gir-resolver.js";
import { resolveLibraries } from "./library-resolver.js";
import { type CodegenStore, resolveCodegenStore } from "./output-resolver.js";

/**
 * Options for {@link runCodegen}.
 */
export type RunCodegenOptions = {
    /** Project root in which to look for `gtkx.config.ts`. Defaults to `process.cwd()`. */
    cwd?: string;
    /**
     * When true, remove the entire generated store and aliases before
     * regenerating, for a guaranteed-fresh tree.
     */
    clean?: boolean;
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
    /** Resolved configuration that produced the run. */
    config?: GtkxConfig;
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

const buildRunner = (
    store: CodegenStore,
    libraries: readonly string[],
    girPath: readonly string[],
    slotProps: Readonly<Record<string, readonly string[]>> | undefined,
): CodegenRunner =>
    new CodegenRunner({
        libraries,
        girPath,
        slotProps,
        gi: {
            storeDir: store.giStoreDir,
            linkDir: store.giLinkDir,
            realFfiDir: store.realFfiDir,
            version: store.ffiVersion,
        },
        jsx:
            store.realReactDir !== null && store.realReactRuntimeDir !== null
                ? {
                      storeDir: store.jsxStoreDir,
                      linkDir: store.jsxLinkDir,
                      giStoreDir: store.giStoreDir,
                      realReactRuntimeDir: store.realReactRuntimeDir,
                      realReactPackageDir: store.realReactDir,
                      version: store.reactVersion ?? store.ffiVersion,
                  }
                : undefined,
    });

/**
 * Runs the codegen pipeline end-to-end against a user project.
 *
 * Loads `gtkx.config.ts`, resolves GIR search paths and the resolved library
 * list, locates the project's installed `@gtkx/ffi`/`@gtkx/react`, and delegates
 * to {@link CodegenRunner}, which materializes the injected `@gtkx/gi` (and,
 * when React is present, `@gtkx/react-jsx`) packages into `node_modules`.
 *
 * Always regenerates: turbo (in the monorepo) and the install lifecycle (for
 * downstream projects) own the decision of whether to invoke codegen at all.
 * With {@link RunCodegenOptions.clean}, the store and aliases are removed first.
 *
 * @param options - {@link RunCodegenOptions}
 * @returns Summary of work performed, plus the resolved config and GIR path
 */
export const runCodegen = async (options: RunCodegenOptions = {}): Promise<RunCodegenResult> => {
    const cwd = options.cwd ?? process.cwd();

    const { config, configFile } = await loadGtkxConfig(cwd);

    const girPath = resolveGirPath(config.girPath);
    const libraries = resolveLibraries(config.libraries, girPath);

    const store = resolveCodegenStore(cwd);

    if (girPath.length === 0) {
        throw new Error(
            "No GIR search paths available. Install gobject-introspection (Linux: `sudo dnf install gobject-introspection-devel` or `sudo apt install libgirepository1.0-dev`), or set `girPath` in gtkx.config.ts.",
        );
    }

    if (options.clean) {
        for (const path of [store.giStoreDir, store.giLinkDir, store.jsxStoreDir, store.jsxLinkDir]) {
            rmSync(path, { recursive: true, force: true });
        }
    }

    const result = await buildRunner(store, libraries, girPath, config.slotProps).run();

    return {
        namespaces: result.namespaces,
        widgets: result.widgets,
        duration: result.duration,
        config,
        girPath,
        configFile,
        libraries,
    };
};

/**
 * Top-level `@gtkx/react-jsx` generated modules that must exist whenever React
 * bindings have been generated.
 */
const REACT_GENERATED_MODULES: readonly string[] = ["compounds.js", "internal.js", "jsx.js"];

/**
 * Absolute path to the generated barrel for a `Name-Version` GIR library
 * identifier, mirroring the gi store layout: `<namespace>/index.js`.
 */
const namespaceBarrelPath = (giStoreDir: string, library: string): string => {
    const separator = library.indexOf("-");
    const namespace = (separator === -1 ? library : library.slice(0, separator)).toLowerCase();
    return join(giStoreDir, namespace, "index.js");
};

/**
 * Returns true if the injected `@gtkx/gi` (or, when the React stack — both
 * `@gtkx/react` and the `react` runtime — is present, `@gtkx/react-jsx`)
 * package is missing a required module or its visible alias.
 *
 * Used by `gtkx dev`/`gtkx build` and by {@link ensureGenerated} to auto-run
 * codegen when the store is absent, partial, or a newly configured library has
 * not been generated. The jsx-freshness branch is gated on the same condition
 * {@link runCodegen} uses to emit the jsx unit — both the `@gtkx/react` package
 * and the `react` runtime resolving — so a project with `@gtkx/react` but no
 * `react` runtime does not wedge on a jsx unit that can never be produced.
 * Deeper staleness (changed GIR, codegen upgrades) is left to the install
 * lifecycle.
 *
 * @param cwd - Project root
 * @param config - The user's resolved configuration
 * @returns True when a required generated module or alias is missing
 */
const isCodegenNeeded = (cwd: string, config: GtkxConfig): boolean => {
    try {
        const store = resolveCodegenStore(cwd);
        if (!existsSync(store.giLinkDir) || !existsSync(store.giStoreDir)) {
            return true;
        }
        const girPath = resolveGirPath(config.girPath);
        const libraries = resolveLibraries(config.libraries, girPath);
        if (libraries.some((library) => !existsSync(namespaceBarrelPath(store.giStoreDir, library)))) {
            return true;
        }
        if (store.realReactDir !== null && store.realReactRuntimeDir !== null) {
            if (!existsSync(store.jsxLinkDir)) return true;
            if (REACT_GENERATED_MODULES.some((module) => !existsSync(join(store.jsxStoreDir, module)))) return true;
        }
        return false;
    } catch {
        return true;
    }
};

/**
 * Regenerates the injected packages when any required module or alias is
 * missing, leaving them untouched otherwise.
 *
 * The injected packages are produced as an install side-effect and are not
 * tracked by the build system, so a cache-restored build can be present without
 * them. Build and typecheck scripts call this first so generation is coupled to
 * the build graph.
 *
 * @param cwd - Project root in which to look for `gtkx.config.ts`
 */
export const ensureGenerated = async (cwd: string): Promise<boolean> => {
    let config: GtkxConfig;
    try {
        ({ config } = await loadGtkxConfig(cwd));
    } catch (error) {
        if (error instanceof GtkxConfigNotFoundError) {
            return false;
        }
        throw error;
    }
    if (!isCodegenNeeded(cwd, config)) {
        return false;
    }
    await runCodegen({ cwd });
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

    let config: GtkxConfig;
    try {
        ({ config } = await loadGtkxConfig(cwd));
    } catch (error) {
        if (error instanceof GtkxConfigNotFoundError) {
            return;
        }
        throw error;
    }

    if (isCodegenNeeded(cwd, config)) {
        console.log("[gtkx] generated bindings missing; running codegen...");
        await runCodegen({ cwd });
    }
};
