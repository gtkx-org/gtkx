/**
 * Names of the flags exposed by GLib's `GApplicationFlags` enum.
 *
 * Mirrors the variants of `Gio.ApplicationFlags` so users can declare them
 * in `gtkx.config.ts` without importing from generated FFI bindings (which
 * would create a chicken-and-egg dependency on first `gtkx codegen` run).
 *
 * The CLI maps each name to its numeric value via `Gio.ApplicationFlags`
 * at dev/build time and OR-combines them into the final bitmask.
 */
export const APPLICATION_FLAG_NAMES = [
    "DEFAULT_FLAGS",
    "IS_SERVICE",
    "IS_LAUNCHER",
    "HANDLES_OPEN",
    "HANDLES_COMMAND_LINE",
    "SEND_ENVIRONMENT",
    "NON_UNIQUE",
    "CAN_OVERRIDE_APP_ID",
    "ALLOW_REPLACEMENT",
    "REPLACE",
] as const;

/**
 * Union of valid `GApplicationFlags` variant names accepted in
 * {@link GtkxConfig.appFlags}.
 */
export type ApplicationFlagName = (typeof APPLICATION_FLAG_NAMES)[number];

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
 *     appId: "com.example.myapp",
 *     libraries: ["Gtk-4.0", "Adw-1"],
 *     appFlags: ["NON_UNIQUE"],
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

    /**
     * GLib application identifier in reverse-DNS form, e.g. `"com.example.myapp"`.
     *
     * Required by `gtkx build`. `gtkx dev` falls back to `"org.gtkx.dev"` when
     * omitted, so quick prototypes work without a config file.
     */
    appId?: string;

    /**
     * `GApplicationFlags` to register the GTK application with, expressed as
     * an array of variant names. The CLI OR-combines them into a single
     * bitmask before passing it to the GTK runtime.
     *
     * Examples: `["NON_UNIQUE"]`, `["IS_LAUNCHER", "HANDLES_OPEN"]`. When
     * omitted, the runtime applies its default flags.
     */
    appFlags?: ApplicationFlagName[];
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
 *     appId: "com.example.myapp",
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

    if (config.appId !== undefined && !isValidAppId(config.appId)) {
        throw new Error(
            `gtkx.config.ts: invalid appId "${config.appId}" — must be a D-Bus well-known name (reverse-DNS, e.g. "com.example.my-app", up to 255 characters)`,
        );
    }

    if (config.appFlags !== undefined) {
        if (!Array.isArray(config.appFlags)) {
            throw new Error("gtkx.config.ts: `appFlags` must be an array of strings if provided");
        }
        for (const flag of config.appFlags) {
            if (!APPLICATION_FLAG_NAMES.includes(flag)) {
                throw new Error(
                    `gtkx.config.ts: invalid appFlag "${flag}" — must be one of ${APPLICATION_FLAG_NAMES.join(", ")}`,
                );
            }
        }
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
