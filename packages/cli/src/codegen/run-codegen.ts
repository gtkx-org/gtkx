import { existsSync, realpathSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { CodegenRunner } from "@gtkx/codegen";
import type { GtkxConfig } from "../config.js";
import { GtkxConfigNotFoundError, loadGtkxConfig } from "./config-loader.js";
import { resolveGirPath } from "./gir-resolver.js";
import { resolveLibraries } from "./library-resolver.js";
import { resolveOutputDirs } from "./output-resolver.js";

/**
 * Options for {@link runCodegen}.
 */
export type RunCodegenOptions = {
    /** Project root in which to look for `gtkx.config.ts`. Defaults to `process.cwd()`. */
    cwd?: string;
    /**
     * When true, remove the entire generated output directories before
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

/**
 * Runs the codegen pipeline end-to-end against a user project.
 *
 * Loads `gtkx.config.ts`, resolves GIR search paths and the resolved
 * library list, locates the user's installed `@gtkx/ffi` and (optional)
 * `@gtkx/react` directories, and delegates to {@link CodegenRunner} which
 * owns the generation, transpile, and disk-write steps.
 *
 * Always regenerates: turbo (in the monorepo) and the install lifecycle (for
 * downstream projects) own the decision of whether to invoke codegen at all.
 * With {@link RunCodegenOptions.clean}, the generated output directories are
 * removed first so nothing stale survives.
 *
 * Performs no logging itself — callers are responsible for presenting status.
 *
 * @param options - {@link RunCodegenOptions}
 * @returns Summary of work performed; includes the resolved config and GIR
 *     path so callers can present them in their own UX
 */
export const runCodegen = async (options: RunCodegenOptions = {}): Promise<RunCodegenResult> => {
    const cwd = options.cwd ?? process.cwd();

    const { config, configFile } = await loadGtkxConfig(cwd);

    const girPath = resolveGirPath(config.girPath);
    const libraries = resolveLibraries(config.libraries, girPath);

    const { ffiOutputDir, reactOutputDir } = resolveOutputDirs(cwd);

    if (girPath.length === 0) {
        throw new Error(
            "No GIR search paths available. Install gobject-introspection (Linux: `sudo dnf install gobject-introspection-devel` or `sudo apt install libgirepository1.0-dev`), or set `girPath` in gtkx.config.ts.",
        );
    }

    if (options.clean) {
        rmSync(ffiOutputDir, { recursive: true, force: true });
        if (reactOutputDir !== null) {
            rmSync(reactOutputDir, { recursive: true, force: true });
        }
    }

    const runner = new CodegenRunner({
        libraries,
        girPath,
        slotProps: config.slotProps,
        ffiOutDir: ffiOutputDir,
        reactOutDir: reactOutputDir ?? undefined,
    });
    const result = await runner.run();

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
 * Returns true if any configured library's generated namespace module is
 * missing from `@gtkx/ffi`'s `generated/` directory.
 *
 * Used by `gtkx dev` and `gtkx build` to auto-run codegen when the output is
 * absent or a newly configured library has not been generated yet. Detecting
 * deeper staleness (changed GIR contents, codegen upgrades) is left to the
 * install lifecycle and turbo, which own when codegen runs.
 *
 * @param cwd - Project root
 * @param config - The user's resolved configuration
 * @returns True when a configured namespace module is missing
 */
const isCodegenNeeded = (cwd: string, config: GtkxConfig): boolean => {
    try {
        const { ffiOutputDir } = resolveOutputDirs(cwd);
        if (!existsSync(ffiOutputDir)) {
            return true;
        }
        const girPath = resolveGirPath(config.girPath);
        const libraries = resolveLibraries(config.libraries, girPath);
        return libraries.some((library) => !existsSync(namespaceModulePath(ffiOutputDir, library)));
    } catch {
        return true;
    }
};

/**
 * Absolute path to the generated `.js` module for a `Name-Version` GIR library
 * identifier, mirroring the codegen output layout: `<namespace>/<namespace>.js`
 * with the namespace lowercased.
 */
const namespaceModulePath = (ffiOutputDir: string, library: string): string => {
    const separator = library.indexOf("-");
    const namespace = (separator === -1 ? library : library.slice(0, separator)).toLowerCase();
    return join(ffiOutputDir, namespace, `${namespace}.js`);
};

/**
 * Best-effort preflight for `gtkx dev` and `gtkx build`.
 *
 * Runs codegen if a `gtkx.config.ts` is present and a configured library's
 * generated namespace module is missing. Returns silently when:
 *
 *   - `GTKX_DISABLE_PREFLIGHT=1` is set in the environment (escape hatch
 *     for unusual workspace layouts)
 *   - `@gtkx/ffi` resolves to a workspace package outside the project's
 *     `node_modules` tree (the workspace's own build pipeline owns the
 *     generated output in that case)
 *   - There is no `gtkx.config.ts` to drive codegen — any missing imports
 *     surface as a clear error from the bundler later
 *
 * @param cwd - Project root
 */
export const preflightCodegen = async (cwd: string): Promise<void> => {
    if (process.env.GTKX_DISABLE_PREFLIGHT === "1") {
        return;
    }
    if (isWorkspaceLinkedFfi(cwd)) {
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

const isWorkspaceLinkedFfi = (cwd: string): boolean => {
    try {
        const projectRequire = createRequire(pathToFileURL(join(cwd, "__gtkx_resolver__.js")).href);
        const ffiPkgPath = projectRequire.resolve("@gtkx/ffi/package.json");
        const realPath = realpathSync(ffiPkgPath);
        const projectNodeModules = resolve(cwd, "node_modules");
        return !realPath.startsWith(`${projectNodeModules}/`);
    } catch {
        return false;
    }
};
