/**
 * User-facing configuration for a GTKX project.
 *
 * Authored in `gtkx.config.ts` at the project root. Loaded by the
 * `gtkx codegen`, `gtkx dev`, and `gtkx build` commands via {@link loadGtkxConfig}.
 *
 * @example
 * ```ts
 * import { defineConfig } from "@gtkx/cli";
 *
 * export default defineConfig({
 *     libraries: ["Gtk-4.0", "Adw-1"],
 * });
 * ```
 */
export type GtkxConfig = {
    /**
     * GLib namespace identifiers (with version) to generate bindings for,
     * e.g. `"Gtk-4.0"`, `"Adw-1"`. Transitive dependencies are resolved
     * automatically from the GIR files on disk.
     */
    libraries: string[];

    /**
     * Additional directories to search for `.gir` files, prepended to the
     * default probe chain. The default chain is:
     *
     * 1. The `GTKX_GIR_PATH` environment variable (colon-separated)
     * 2. `/usr/share/gir-1.0` (the standard system location on Linux)
     * 3. The output of `pkg-config --variable=girdir gobject-introspection-1.0`
     *
     * Paths are resolved relative to the project root.
     */
    girPath?: string[];
};

/**
 * Identity helper that lets users author a {@link GtkxConfig} with full
 * type-checking and IDE autocompletion.
 *
 * Validates the config eagerly at load time so misconfigurations surface
 * before any GIR loading or codegen work begins.
 *
 * @param config - The configuration object
 * @returns The same configuration object after validation
 *
 * @example
 * ```ts
 * import { defineConfig } from "@gtkx/cli";
 *
 * export default defineConfig({
 *     libraries: ["Gtk-4.0", "Adw-1"],
 *     girPath: ["/opt/custom/share/gir-1.0"],
 * });
 * ```
 */
export const defineConfig = (config: GtkxConfig): GtkxConfig => {
    if (!Array.isArray(config.libraries) || config.libraries.length === 0) {
        throw new Error("gtkx.config.ts: `libraries` must be a non-empty string array");
    }

    for (const library of config.libraries) {
        if (typeof library !== "string" || !/^[A-Za-z][A-Za-z0-9]*-\d+(?:\.\d+)*$/.test(library)) {
            throw new Error(
                `gtkx.config.ts: invalid library identifier "${library}" — must be of the form "Name-Version" (e.g. "Gtk-4.0")`,
            );
        }
    }

    if (config.girPath !== undefined && !Array.isArray(config.girPath)) {
        throw new Error("gtkx.config.ts: `girPath` must be an array of strings if provided");
    }

    return config;
};

const APP_ID_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)+$/;
const APP_ID_MAX_LENGTH = 255;

/**
 * Validates an application ID against the D-Bus well-known name spec used by
 * GTK 4's `g_application_id_is_valid`.
 *
 * Rules enforced:
 *   - At least two `.`-separated elements
 *   - Each element starts with `[A-Za-z_]` and continues with `[A-Za-z0-9_-]`
 *   - Total length 1..=255 characters
 *
 * @param appId - The candidate identifier
 * @returns `true` if the identifier is a valid GTK application ID
 */
export const isValidAppId = (appId: string): boolean => {
    if (appId.length === 0 || appId.length > APP_ID_MAX_LENGTH) {
        return false;
    }
    return APP_ID_PATTERN.test(appId);
};
