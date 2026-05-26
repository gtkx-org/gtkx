/**
 * Sentinel {@link GtkxConfig.libraries} value selecting every `.gir` file
 * found on the resolved GIR search path.
 */
export const LIBRARIES_WILDCARD = "*";

/**
 * Matches a `Name-Version` GIR namespace identifier such as `Gtk-4.0` or
 * `GLib-2.0`: a leading-alpha alphanumeric name, a `-`, then one or more
 * dot-separated numeric version components.
 */
export const GIR_NAMESPACE_PATTERN = /^[A-Za-z][A-Za-z0-9]*-\d+(?:\.\d+)*$/;

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
     *
     * Set to `"*"` to generate bindings for every `.gir` file discovered on
     * the resolved GIR search path, keeping the newest version of each
     * namespace.
     *
     * When omitted, defaults to `["Gtk-4.0", "Adw-1"]`.
     */
    libraries?: typeof LIBRARIES_WILDCARD | string[];

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
     * GLib application id used by the GResource pipeline and exposed to
     * application code as `import.meta.env.GTKX_APP_ID`.
     *
     * When set, asset imports resolve to `resource:///<prefix>/<...>` where
     * `<prefix>` is derived from the id (`org.gtk.Demo4` → `/org/gtk/Demo4`).
     * Must match `g_application_id_is_valid` — see {@link isValidAppId}.
     *
     * When omitted, the GResource pipeline falls back to the prefix
     * `/gtkx/app` and `import.meta.env.GTKX_APP_ID` is the empty string.
     */
    applicationId?: string;

    /**
     * Additional widget-typed properties to expose as renderable JSX child
     * slots (typed as `ReactNode`) rather than as plain widget-reference props.
     *
     * Keys are JSX element names (e.g. `"GtkWindow"`, `"AdwFooBar"`); values
     * are camelCase property names. Entries merge with the built-in slot map,
     * so consumer-provided GIRs can opt their own widget-typed properties
     * into the slot-mounting pipeline without patching the codegen package.
     *
     * @example
     * ```ts
     * slotProps: {
     *     MyAppFooBar: ["content"],
     * }
     * ```
     */
    slotProps?: Record<string, string[]>;
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
const validateLibraryEntry = (library: unknown): void => {
    if (typeof library === "string" && GIR_NAMESPACE_PATTERN.test(library)) {
        return;
    }
    if (library === LIBRARIES_WILDCARD) {
        throw new Error(
            'gtkx.config.ts: to generate every library, set `libraries: "*"` as a bare string, not an array entry',
        );
    }
    throw new Error(
        `gtkx.config.ts: invalid library identifier "${String(library)}" — must be of the form "Name-Version" (e.g. "Gtk-4.0")`,
    );
};

const validateLibraries = (libraries: GtkxConfig["libraries"]): void => {
    if (libraries === undefined || libraries === LIBRARIES_WILDCARD) {
        return;
    }
    if (!Array.isArray(libraries) || libraries.length === 0) {
        throw new Error('gtkx.config.ts: `libraries` must be "*", a non-empty string array, or omitted');
    }
    for (const library of libraries) {
        validateLibraryEntry(library);
    }
};

const validateGirPath = (girPath: GtkxConfig["girPath"]): void => {
    if (girPath !== undefined && !Array.isArray(girPath)) {
        throw new Error("gtkx.config.ts: `girPath` must be an array of strings if provided");
    }
};

const validateApplicationId = (applicationId: GtkxConfig["applicationId"]): void => {
    if (applicationId === undefined) return;
    if (typeof applicationId !== "string" || !isValidAppId(applicationId)) {
        throw new Error(
            `gtkx.config.ts: invalid \`applicationId\` "${String(applicationId)}" — ` +
                `must satisfy g_application_id_is_valid (e.g. "org.example.MyApp")`,
        );
    }
};

const JSX_NAME_PATTERN = /^[A-Z][A-Za-z0-9]*$/;
const SLOT_PROP_PATTERN = /^[a-z][A-Za-z0-9]*$/;

const validateSlotProps = (slotProps: GtkxConfig["slotProps"]): void => {
    if (slotProps === undefined) return;
    if (typeof slotProps !== "object" || Array.isArray(slotProps) || slotProps === null) {
        throw new Error(
            "gtkx.config.ts: `slotProps` must be an object mapping JSX names to arrays of camelCase property names",
        );
    }
    for (const [jsxName, props] of Object.entries(slotProps)) {
        if (!JSX_NAME_PATTERN.test(jsxName)) {
            throw new Error(
                `gtkx.config.ts: invalid \`slotProps\` key "${jsxName}" — must be a PascalCase JSX element name (e.g. "MyAppFooBar")`,
            );
        }
        if (!Array.isArray(props) || props.length === 0) {
            throw new Error(
                `gtkx.config.ts: \`slotProps.${jsxName}\` must be a non-empty array of camelCase property names`,
            );
        }
        for (const prop of props) {
            if (typeof prop !== "string" || !SLOT_PROP_PATTERN.test(prop)) {
                throw new Error(
                    `gtkx.config.ts: invalid \`slotProps.${jsxName}\` entry "${String(prop)}" — must be a camelCase property name (e.g. "content")`,
                );
            }
        }
    }
};

export const defineConfig = (config: GtkxConfig): GtkxConfig => {
    validateLibraries(config.libraries);
    validateGirPath(config.girPath);
    validateApplicationId(config.applicationId);
    validateSlotProps(config.slotProps);
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
