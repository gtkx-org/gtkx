import { loadConfig } from "c12";
import { defineConfig, type GtkxConfig } from "../config.js";

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

    if (!result.configFile || !result.config || Object.keys(result.config).length === 0) {
        throw new GtkxConfigNotFoundError(cwd);
    }

    return {
        config: defineConfig(result.config),
        configFile: result.configFile,
        rootDir: result.cwd ?? cwd,
    };
};
