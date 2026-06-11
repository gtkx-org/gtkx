import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "c12";
import { defineConfig, type GtkxConfig, type ResolvedGtkxConfig, resolveGtkxConfig } from "./config.js";

/**
 * Outcome of loading a `gtkx.config.ts` file.
 */
export type LoadedConfig = {
    /** The validated configuration. */
    config: GtkxConfig;
    /** Absolute path to the config file that was loaded, if any. */
    configFile: string | undefined;
    /** Project root directory used for resolving relative paths. */
    rootDir: string;
};

/**
 * Thrown by {@link loadGtkxConfig} when no `gtkx.config.{ts,js,...}` exists in
 * the search root. Distinct error type so callers can react specifically
 * (e.g. `preflightCodegen` silences this case but propagates other errors).
 */
export class GtkxConfigNotFoundError extends Error {
    constructor(cwd: string) {
        super(
            `No gtkx.config.ts found in ${cwd}.\n` +
                `Create one with:\n` +
                `\n` +
                `  // gtkx.config.ts\n` +
                `  import { defineConfig } from "@gtkx/cli";\n` +
                `\n` +
                `  export default defineConfig({\n` +
                `      libraries: ["Gtk-4.0", "Adw-1"],\n` +
                `  });\n`,
        );
        this.name = "GtkxConfigNotFoundError";
    }
}

/**
 * Loads `gtkx.config.{ts,js,mjs,cjs,mts,cts}` from the project root via c12+jiti.
 *
 * The TypeScript file is executed in-process (no separate compile step) and
 * its default export is taken as the config. The loaded value is normalized
 * through {@link defineConfig} so the same validation runs whether the user
 * invoked `defineConfig` themselves in the file or just exported a plain
 * object literal.
 *
 * @param cwd - Project root in which to search for the config file
 * @returns The validated config and resolution metadata
 * @throws {@link GtkxConfigNotFoundError} when no config file is found
 * @throws Any validation error from {@link defineConfig}
 */
export const loadGtkxConfig = async (cwd: string): Promise<LoadedConfig> => {
    const result = await loadConfig<GtkxConfig>({
        name: "gtkx",
        cwd,
        rcFile: false,
        globalRc: false,
        packageJson: false,
    });

    if (!result.configFile || !result.config || !existsSync(resolve(cwd, result.configFile))) {
        throw new GtkxConfigNotFoundError(cwd);
    }

    return {
        config: defineConfig(result.config),
        configFile: result.configFile,
        rootDir: result.cwd ?? cwd,
    };
};

/**
 * Loads and resolves `gtkx.config.ts` from the project root, treating a
 * missing config file as an empty configuration.
 *
 * This is the loader the virtual-module plumbing uses: every consumer of
 * `virtual:gtkx-config` receives a fully populated {@link ResolvedGtkxConfig}
 * whether or not the project declares a config file. Validation errors from
 * an existing config still propagate.
 *
 * @param cwd - Project root in which to search for the config file
 * @returns The resolved configuration, defaulted when no config file exists
 */
export const loadResolvedGtkxConfig = async (cwd: string): Promise<ResolvedGtkxConfig> => {
    try {
        const { config } = await loadGtkxConfig(cwd);
        return resolveGtkxConfig(config);
    } catch (error) {
        if (error instanceof GtkxConfigNotFoundError) {
            return resolveGtkxConfig({});
        }
        throw error;
    }
};

/**
 * A memoizing form of {@link loadResolvedGtkxConfig}: per project root, the
 * config file is loaded and resolved at most once.
 */
export type GtkxConfigLoader = (cwd: string) => Promise<ResolvedGtkxConfig>;

/**
 * Creates a {@link GtkxConfigLoader} backed by a per-root promise cache, so a
 * pipeline whose plugins each need the resolved config performs a single load.
 *
 * @returns The memoizing loader
 *
 * @example
 * ```ts
 * const loadResolved = createGtkxConfigLoader();
 * const config = await loadResolved(projectRoot);
 * ```
 */
export const createGtkxConfigLoader = (): GtkxConfigLoader => {
    const cache = new Map<string, Promise<ResolvedGtkxConfig>>();
    return (cwd: string): Promise<ResolvedGtkxConfig> => {
        const root = resolve(cwd);
        let pending = cache.get(root);
        if (!pending) {
            pending = loadResolvedGtkxConfig(root);
            cache.set(root, pending);
        }
        return pending;
    };
};
