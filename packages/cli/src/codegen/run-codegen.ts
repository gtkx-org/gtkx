import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { CodegenRunner } from "@gtkx/codegen";
import type { GtkxConfig } from "../config.js";
import { computeInputHash, isCacheValid, writeCacheManifest } from "./codegen-cache.js";
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
    /** When true, skip the cache check and regenerate unconditionally. */
    force?: boolean;
};

/**
 * Result of a codegen invocation.
 */
export type RunCodegenResult = {
    /** Whether the codegen pipeline actually ran (false if the cache was hit). */
    ran: boolean;
    /** Number of namespaces processed (0 if cached). */
    namespaces: number;
    /** Number of widgets metadata-collected for React (0 if cached). */
    widgets: number;
    /** Wall-clock duration in milliseconds (0 if cached). */
    duration: number;
    /** Resolved configuration that produced the run, or `null` if cached. */
    config?: GtkxConfig;
    /** Resolved GIR search path used by the run, or `null` if cached. */
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
 * Skips work when the input hash matches the cache manifest, unless `force`.
 *
 * Performs no logging itself — callers are responsible for presenting status.
 *
 * @param options - {@link RunCodegenOptions}
 * @returns Summary of work performed; includes the resolved config and GIR
 *     path so callers can present them in their own UX
 */
export const runCodegen = async (options: RunCodegenOptions = {}): Promise<RunCodegenResult> => {
    const cwd = options.cwd ?? process.cwd();
    const force = options.force ?? false;

    const { config, configFile } = await loadGtkxConfig(cwd);
    const codegenVersion = readCodegenVersion();

    const girPath = resolveGirPath(config.girPath);
    const libraries = resolveLibraries(config.libraries, girPath);
    const inputHash = computeInputHash(libraries, config.girPath, config.slotProps, codegenVersion);

    const { ffiOutputDir, reactOutputDir } = resolveOutputDirs(cwd);

    if (!force && isCacheValid(cwd, inputHash) && existsSync(ffiOutputDir)) {
        return { ran: false, namespaces: 0, widgets: 0, duration: 0 };
    }

    if (girPath.length === 0) {
        throw new Error(
            "No GIR search paths available. Install gobject-introspection (Linux: `sudo dnf install gobject-introspection-devel` or `sudo apt install libgirepository1.0-dev`), or set `girPath` in gtkx.config.ts.",
        );
    }

    const runner = new CodegenRunner({
        libraries,
        girPath,
        slotProps: config.slotProps,
        ffiOutDir: ffiOutputDir,
        reactOutDir: reactOutputDir ?? undefined,
    });
    const result = await runner.run();

    writeCacheManifest(cwd, inputHash, codegenVersion);

    return {
        ran: true,
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
 * Returns true if the user's `node_modules/@gtkx/ffi/dist/generated/`
 * directory is missing or stale relative to the cache manifest.
 *
 * Used by `gtkx dev` and `gtkx build` to decide whether to auto-run codegen
 * before starting their work.
 *
 * @param cwd - Project root
 * @param config - The user's resolved configuration
 * @returns True when codegen output is missing or stale by manifest hash
 */
const isCodegenNeeded = (cwd: string, config: GtkxConfig): boolean => {
    try {
        const { ffiOutputDir } = resolveOutputDirs(cwd);
        if (!existsSync(ffiOutputDir)) {
            return true;
        }

        const girPath = resolveGirPath(config.girPath);
        const libraries = resolveLibraries(config.libraries, girPath);
        const codegenVersion = readCodegenVersion();
        const inputHash = computeInputHash(libraries, config.girPath, config.slotProps, codegenVersion);
        return !isCacheValid(cwd, inputHash);
    } catch {
        return true;
    }
};

/**
 * Best-effort preflight for `gtkx dev` and `gtkx build`.
 *
 * Runs codegen if a `gtkx.config.ts` is present and the cache or output dir
 * are stale or missing. Returns silently when:
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
        const loaded = await loadGtkxConfig(cwd);
        config = loaded.config;
    } catch (error) {
        if (error instanceof GtkxConfigNotFoundError) {
            return;
        }
        throw error;
    }

    if (isCodegenNeeded(cwd, config)) {
        console.log("[gtkx] generated bindings missing or stale; running codegen...");
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

const readCodegenVersion = (): string => {
    const require = createRequire(import.meta.url);
    const pkgPath = require.resolve("@gtkx/codegen/package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string };
    return pkg.version;
};
