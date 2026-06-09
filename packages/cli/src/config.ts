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
     * The namespaces `["Gtk-4.0", "Adw-1", "GtkSource-5", "WebKit-6.0"]` are
     * always generated, since `@gtkx/react`'s built-in nodes depend on them.
     * An explicit array is merged with this always-on set and deduplicated,
     * not used in its place. When omitted, only the always-on set is
     * generated.
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
     * application code as `import.meta.env.GTKX_APPLICATION_ID`.
     *
     * When set, asset imports resolve to `resource:///<prefix>/<rel>` where
     * `<prefix>` is derived from the id (`org.gtk.Demo4` → `/org/gtk/Demo4`)
     * and `<rel>` is the file's path relative to the Vite `root`. To land an
     * asset at an exact path — e.g. `style.css` at the GApplication default
     * `resource_base_path` for Adw/Gtk auto-loading — pin it with a
     * `?resource=<path>` import query.
     * Must match `g_application_id_is_valid` — see {@link isValidApplicationId}.
     *
     * When omitted, the GResource pipeline falls back to the prefix
     * `/gtkx/app` and `import.meta.env.GTKX_APPLICATION_ID` is the empty string.
     */
    applicationId?: string;

    /**
     * Additional widget-typed properties to expose as renderable JSX child
     * slots (typed as `ReactNode`) with setter semantics — the value replaces
     * the slot's single child — rather than as plain widget-reference props.
     *
     * Keys are JSX element names (e.g. `"GtkWindow"`, `"AdwFooBar"`); values
     * are camelCase property names. Entries merge with the built-in widget-slot
     * map, so consumer-provided GIRs can opt their own widget-typed properties
     * into the slot-mounting pipeline without patching the codegen package.
     *
     * @example
     * ```ts
     * widgetSlots: {
     *     MyAppFooBar: ["content"],
     * }
     * ```
     */
    widgetSlots?: Record<string, string[]>;

    /**
     * Additional container methods to expose as renderable JSX child slots
     * (typed as `ReactNode`) with append semantics — each child is appended via
     * the named method instead of replacing a single value.
     *
     * Keys are JSX element names (e.g. `"GtkHeaderBar"`, `"AdwActionRow"`);
     * values are camelCase method names that append a child onto the widget
     * (e.g. `"packStart"`, `"addPrefix"`). The reconciler dispatches each slot
     * to `parent[method](child)`. Entries merge with the built-in container-slot
     * map, so consumer-provided GIRs can opt their own append methods into the
     * slot-mounting pipeline without patching the codegen package.
     *
     * @example
     * ```ts
     * containerSlots: {
     *     MyAppHeaderBar: ["packStart", "packEnd"],
     * }
     * ```
     */
    containerSlots?: Record<string, string[]>;

    /**
     * Additional array-valued props to expose on a widget's JSX surface, where
     * each element maps to a repeated GTK call rather than a single property set.
     *
     * Keys are PascalCase JSX element names (e.g. `"GtkScale"`, `"MyAppChart"`);
     * each value maps a camelCase prop name to an item-type name. The item type
     * must be an exported member of `@gtkx/react` — codegen type-imports it from
     * that hard-coded path and emits `prop?: ItemType[] | null;` into the element's
     * generated `Props` interface, suppressing the raw GObject prop of the same
     * name. Entries merge with the built-in array-prop map. The runtime
     * add/remove/clear behavior is not configured here: it lives in `@gtkx/react`'s
     * `ARRAY_PROPS`, keyed by the same element and prop names.
     *
     * @example
     * ```ts
     * arrayProps: {
     *     MyAppChart: { series: "ChartSeries" },
     * }
     * ```
     */
    arrayProps?: Record<string, Record<string, string>>;

    /**
     * Controls the React Compiler (`babel-plugin-react-compiler`), which
     * auto-memoizes components and hooks at build time so the reconciler
     * commits fewer GObject property sets and signal reconnections per render.
     *
     * Enabled by default for every `gtkx dev`, `gtkx build`, and test run: the
     * compiler transforms the project's own `.ts`/`.tsx` source (files under
     * the project root, excluding `node_modules`) with `target: "19"`, matching
     * GTKX's required React version.
     *
     * Set to `false` to disable it, or pass an object to tune the compiler.
     *
     * @example
     * ```ts
     * reactCompiler: false,
     * ```
     *
     * @example
     * ```ts
     * reactCompiler: { compilationMode: "annotation" },
     * ```
     */
    reactCompiler?: boolean | ReactCompilerOptions;
};

/**
 * The React Compiler `compilationMode`: which functions it attempts to
 * optimize. `"infer"` (the compiler default) memoizes functions recognized as
 * components or hooks; `"annotation"` only those marked with a `"use memo"`
 * directive; `"all"` every top-level function; `"syntax"` only those using
 * optimization-eligible syntax.
 */
export type ReactCompilerCompilationMode = "infer" | "syntax" | "annotation" | "all";

/**
 * The React Compiler `panicThreshold`: how it reacts to code it cannot safely
 * optimize. `"none"` (the compiler default) silently skips such functions;
 * `"critical_errors"` fails the build on critical diagnostics; `"all_errors"`
 * fails on any diagnostic.
 */
export type ReactCompilerPanicThreshold = "none" | "critical_errors" | "all_errors";

/**
 * User-tunable subset of `babel-plugin-react-compiler` options exposed through
 * {@link GtkxConfig.reactCompiler}. The compiler `target` is always `"19"`,
 * matching GTKX's required React version, and is not configurable.
 */
export type ReactCompilerOptions = {
    /**
     * See {@link ReactCompilerCompilationMode}. Omit to let the compiler
     * default (`"infer"`) apply.
     */
    compilationMode?: ReactCompilerCompilationMode;
    /**
     * See {@link ReactCompilerPanicThreshold}. Omit to let the compiler
     * default (`"none"`) apply.
     */
    panicThreshold?: ReactCompilerPanicThreshold;
};

/**
 * The fully resolved option object handed to `babel-plugin-react-compiler`,
 * produced by {@link resolveReactCompilerOptions}.
 */
export type ResolvedReactCompilerOptions = ReactCompilerOptions & {
    /** Pinned to GTKX's required React major. */
    target: "19";
};

const REACT_COMPILER_TARGET = "19";

/**
 * Maps a {@link GtkxConfig.reactCompiler} setting to the option object passed
 * to `babel-plugin-react-compiler`, or `null` when the compiler is disabled.
 *
 * `false` disables it; `undefined` and `true` enable it with defaults; an
 * object enables it with the given overrides. The `target` is always forced
 * to `"19"`.
 *
 * @param setting - The `reactCompiler` value from `gtkx.config.ts`
 * @returns The resolved compiler options, or `null` when disabled
 */
export const resolveReactCompilerOptions = (
    setting: GtkxConfig["reactCompiler"],
): ResolvedReactCompilerOptions | null => {
    if (setting === false) return null;
    const overrides = setting === undefined || setting === true ? {} : setting;
    return { ...overrides, target: REACT_COMPILER_TARGET };
};

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
    if (typeof applicationId !== "string" || !isValidApplicationId(applicationId)) {
        throw new Error(
            `gtkx.config.ts: invalid \`applicationId\` "${String(applicationId)}" — ` +
                `must satisfy g_application_id_is_valid (e.g. "org.example.MyApp")`,
        );
    }
};

const JSX_NAME_PATTERN = /^[A-Z][A-Za-z0-9]*$/;
const SLOT_ENTRY_PATTERN = /^[a-z][A-Za-z0-9]*$/;
const ITEM_TYPE_PATTERN = /^[A-Z][A-Za-z0-9]*$/;

const validateSlotMap = (slotMap: Record<string, string[]> | undefined, optionName: string): void => {
    if (slotMap === undefined) return;
    if (typeof slotMap !== "object" || Array.isArray(slotMap) || slotMap === null) {
        throw new Error(
            `gtkx.config.ts: \`${optionName}\` must be an object mapping JSX names to arrays of camelCase names`,
        );
    }
    for (const [jsxName, names] of Object.entries(slotMap)) {
        if (!JSX_NAME_PATTERN.test(jsxName)) {
            throw new Error(
                `gtkx.config.ts: invalid \`${optionName}\` key "${jsxName}" — must be a PascalCase JSX element name (e.g. "MyAppFooBar")`,
            );
        }
        if (!Array.isArray(names) || names.length === 0) {
            throw new Error(
                `gtkx.config.ts: \`${optionName}.${jsxName}\` must be a non-empty array of camelCase names`,
            );
        }
        for (const name of names) {
            if (typeof name !== "string" || !SLOT_ENTRY_PATTERN.test(name)) {
                throw new Error(
                    `gtkx.config.ts: invalid \`${optionName}.${jsxName}\` entry "${String(name)}" — must be a camelCase name (e.g. "content")`,
                );
            }
        }
    }
};

const validateArrayPropEntry = (props: Record<string, string>, optionName: string, jsxName: string): void => {
    if (typeof props !== "object" || Array.isArray(props) || props === null || Object.keys(props).length === 0) {
        throw new Error(
            `gtkx.config.ts: \`${optionName}.${jsxName}\` must be a non-empty object mapping camelCase prop names to item-type names`,
        );
    }
    for (const [propName, itemType] of Object.entries(props)) {
        if (!SLOT_ENTRY_PATTERN.test(propName)) {
            throw new Error(
                `gtkx.config.ts: invalid \`${optionName}.${jsxName}\` prop "${propName}" — must be a camelCase name (e.g. "marks")`,
            );
        }
        if (typeof itemType !== "string" || !ITEM_TYPE_PATTERN.test(itemType)) {
            throw new Error(
                `gtkx.config.ts: invalid \`${optionName}.${jsxName}.${propName}\` item type "${String(itemType)}" — must be a PascalCase exported member of @gtkx/react (e.g. "ScaleMark")`,
            );
        }
    }
};

const validateArrayProps = (
    arrayProps: Record<string, Record<string, string>> | undefined,
    optionName: string,
): void => {
    if (arrayProps === undefined) return;
    if (typeof arrayProps !== "object" || Array.isArray(arrayProps) || arrayProps === null) {
        throw new Error(
            `gtkx.config.ts: \`${optionName}\` must be an object mapping JSX names to objects of camelCase prop names to item-type names`,
        );
    }
    for (const [jsxName, props] of Object.entries(arrayProps)) {
        if (!JSX_NAME_PATTERN.test(jsxName)) {
            throw new Error(
                `gtkx.config.ts: invalid \`${optionName}\` key "${jsxName}" — must be a PascalCase JSX element name (e.g. "MyAppChart")`,
            );
        }
        validateArrayPropEntry(props, optionName, jsxName);
    }
};

const REACT_COMPILER_COMPILATION_MODES: readonly ReactCompilerCompilationMode[] = [
    "infer",
    "syntax",
    "annotation",
    "all",
];

const REACT_COMPILER_PANIC_THRESHOLDS: readonly ReactCompilerPanicThreshold[] = [
    "none",
    "critical_errors",
    "all_errors",
];

const validateReactCompilerEnum = <T extends string>(
    value: T | undefined,
    allowed: readonly T[],
    field: string,
): void => {
    if (value !== undefined && !allowed.includes(value)) {
        throw new Error(
            `gtkx.config.ts: invalid \`reactCompiler.${field}\` "${String(value)}" — must be one of ${allowed.join(", ")}`,
        );
    }
};

const validateReactCompiler = (reactCompiler: GtkxConfig["reactCompiler"]): void => {
    if (reactCompiler === undefined || typeof reactCompiler === "boolean") return;
    if (typeof reactCompiler !== "object" || reactCompiler === null || Array.isArray(reactCompiler)) {
        throw new Error("gtkx.config.ts: `reactCompiler` must be a boolean or an options object");
    }
    validateReactCompilerEnum(reactCompiler.compilationMode, REACT_COMPILER_COMPILATION_MODES, "compilationMode");
    validateReactCompilerEnum(reactCompiler.panicThreshold, REACT_COMPILER_PANIC_THRESHOLDS, "panicThreshold");
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
    validateLibraries(config.libraries);
    validateGirPath(config.girPath);
    validateApplicationId(config.applicationId);
    validateSlotMap(config.widgetSlots, "widgetSlots");
    validateSlotMap(config.containerSlots, "containerSlots");
    validateArrayProps(config.arrayProps, "arrayProps");
    validateReactCompiler(config.reactCompiler);
    return config;
};

const APPLICATION_ID_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)+$/;
const APPLICATION_ID_MAX_LENGTH = 255;

/**
 * Validates an application ID against the D-Bus well-known name spec used by
 * GTK 4's `g_application_id_is_valid`.
 *
 * Rules enforced:
 *   - At least two `.`-separated elements
 *   - Each element starts with `[A-Za-z_]` and continues with `[A-Za-z0-9_-]`
 *   - Total length 1..=255 characters
 *
 * @param applicationId - The candidate identifier
 * @returns `true` if the identifier is a valid GTK application ID
 */
export const isValidApplicationId = (applicationId: string): boolean => {
    if (applicationId.length === 0 || applicationId.length > APPLICATION_ID_MAX_LENGTH) {
        return false;
    }
    return APPLICATION_ID_PATTERN.test(applicationId);
};
