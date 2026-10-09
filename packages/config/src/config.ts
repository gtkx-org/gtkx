import { createDefineConfig, type DefineConfig } from "c12";
import { defu } from "defu";
import { resolve } from "node:path";
import { z } from "zod";
import { configError, isRecord } from "./config-error.ts";
import { deploySchema } from "./deploy.ts";
import { girLibrary, text } from "./schema-text.ts";
import { resolveUserEventSignals } from "./user-event-signals.ts";

/** Object form of the `reactCompiler` config key, forwarded to `babel-plugin-react-compiler`. */
type ReactCompilerOptions = {
    /** Which functions the compiler processes. */
    compilationMode?: (typeof COMPILATION_MODES)[number];
    /** Which compiler diagnostics fail the build. */
    panicThreshold?: (typeof PANIC_THRESHOLDS)[number];
};

/**
 * The React Compiler options the build hands to `babel-plugin-react-compiler`, with the React version
 * GTKX targets filled in.
 */
type ResolvedReactCompilerOptions = ReactCompilerOptions & {
    /** React major version the compiler emits for. */
    target: "19";
};

/**
 * GTKX project configuration authored in `gtkx.config.ts` and validated when loaded.
 */
type Config = z.infer<typeof configSchema>;
type ModuleExport = z.infer<typeof moduleExportSchema>;
type ElementPropsExport = z.infer<typeof elementPropsSchema>;
/** Overrides for one GLib type in `elements.config`, keyed by its registered type name. */
type ElementConfigOptions = z.infer<typeof elementConfigSchema>;

type McpSettings = {
    tools: string[];
    isReadOnly: boolean;
};

/** Configuration reduced to the values the app runtime and the build need, with paths already resolved. */
type ResolvedConfig = {
    /** The GApplication identifier the app registers under. */
    applicationId: string;
    /** React Compiler options for the build, or `null` when the compiler is disabled. */
    reactCompiler: ResolvedReactCompilerOptions | null;
    /**
     * Signal names, keyed by GLib type name, that stay suppressed while a React commit writes to a widget.
     * `notify` stays suppressed only for the property being written.
     */
    userEventSignals: Record<string, string[]>;
    /** Path of the module exporting per-element configs, or `null` when none is configured. */
    elements: string | null;
    /** GLib type names of the elements marked `isLazy`, whose GObject their parent container creates. */
    lazyElements: string[];
};

const APPLICATION_ID_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)+$/;
const APPLICATION_ID_MAX_LENGTH = 255;
const IMPLICIT_LIBRARIES: Set<string> = new Set(["Adw-1", "Gtk-4.0"]);
/** Compilation modes `babel-plugin-react-compiler` accepts. */
const COMPILATION_MODES = ["infer", "syntax", "annotation", "all"] as const;
/** Panic thresholds `babel-plugin-react-compiler` accepts. */
const PANIC_THRESHOLDS = ["none", "critical_errors", "all_errors"] as const;
const REACT_COMPILER_TARGET = "19";

const librarySchema = girLibrary('must be of the form "Name-Version", such as "Adw-1"').refine(
    (library) => !IMPLICIT_LIBRARIES.has(library),
    { error: "is bound implicitly; remove it" },
);

const librariesSchema = z
    .array(librarySchema, { error: "must be a non-empty string array or omitted" })
    .min(1, { error: "must be a non-empty string array or omitted" });

const applicationIdSchema = z
    .string({ error: "must satisfy g_application_id_is_valid" })
    .refine((value) => isValidApplicationId(value), {
        error: 'must satisfy g_application_id_is_valid, such as "org.example.MyApp"',
    });

const reactCompilerSchema = z.union([
    z.boolean(),
    z.strictObject({
        /** Which functions the React Compiler processes. */
        compilationMode: z.enum(COMPILATION_MODES).optional(),
        /** Which React Compiler diagnostics fail the build. */
        panicThreshold: z.enum(PANIC_THRESHOLDS).optional(),
    }),
]);

const userEventSignalsSchema = z.record(
    z.string(),
    z.array(
        z.string({ error: "must be a non-empty signal name" }).min(1, { error: "must be a non-empty signal name" }),
        {
            error: "must be an array of signal names",
        },
    ),
    { error: "must be a record of GLib type names to signal name arrays" },
);

const moduleExportSchema = z.strictObject(
    {
        /** Module specifier containing the named export. */
        module: z.string({ error: "must be a module specifier" }).min(1, { error: "must be a module specifier" }),
        /** Name of the export to import from the module. */
        export: z.string({ error: "must be an export name" }).min(1, { error: "must be an export name" }),
    },
    { error: "must be a { module, export } object" },
);

const elementPropsSchema = moduleExportSchema.extend({
    /**
     * How the exported props are combined: `intersection` is inherited; `factory` applies only to this type.
     * Defaults to `intersection`.
     */
    composition: z.enum(["factory", "intersection"]).optional(),
    /** Props that can only be set when the element is created; changing them afterward throws. */
    constructOnly: z.array(z.string()).optional(),
});

/** Schema for one element override and the source of {@link ElementConfigOptions}. */
const elementConfigSchema = z.strictObject({
    /** Component export that wraps the generated element. */
    component: moduleExportSchema.optional(),
    /** Additional props type to combine with the generated element props. */
    props: elementPropsSchema.optional(),
    /** Whether the parent container creates this element's GObject instead of the element constructing its own. */
    isLazy: z.boolean({ error: "must be a boolean" }).optional(),
    /** Accepted child GLib type names to show in the generated element documentation. */
    acceptedChildTypes: z.array(z.string()).optional(),
    /** GObject properties to leave out of generated props, such as properties managed by an element behavior. */
    omittedProps: z
        .array(
            z.string({ error: "must be a non-empty property name" }).min(1, {
                error: "must be a non-empty property name",
            }),
            { error: "must be an array of property names" },
        )
        .optional(),
});

const elementsSchema = z.strictObject({
    /** Path, relative to the project root, of the module exporting the element behavior map. */
    behaviors: z
        .string({ error: "must be a path to a module exporting element behaviors" })
        .min(1, { error: "must be a path to a module exporting element behaviors" })
        .optional(),
    /**
     * Element configuration overrides keyed by GLib type name, such as `GtkWidget`.
     * @see {@link ElementConfigOptions} for the fields accepted by each entry.
     */
    config: z.record(z.string(), elementConfigSchema).optional(),
});

const agentsSchema = z.strictObject({
    /**
     * Whether codegen maintains the GTKX rules in `AGENTS.md` and creates a missing `CLAUDE.md` import.
     * Defaults to `true`.
     */
    rules: z.boolean({ error: "must be a boolean" }).optional(),
    /** Whether codegen writes the generated element reference to `.gtkx/reference`. Defaults to `true`. */
    reference: z.boolean({ error: "must be a boolean" }).optional(),
});

const mcpSchema = z.strictObject({
    /**
     * Tool name patterns applied in order: `*` matches any text and a leading `!` excludes matches.
     * Omitted, empty, or exclusion-only lists start with all tools; other lists start with none.
     */
    tools: z
        .array(z.string({ error: "must be a tool name pattern" }).min(1, { error: "must be a tool name pattern" }), {
            error: "must be an array of tool name patterns",
        })
        .optional(),
    /**
     * Whether the MCP server exposes only inspection and reference tools, excluding app interactions.
     * Defaults to `false`.
     */
    readOnly: z.boolean({ error: "must be a boolean" }).optional(),
});

const graduatedFutureSchema = z
    .object({
        v2ByteArrays: z.literal(true, { error: "can only be true; remove the flag" }).optional(),
        v2ValueReturns: z.literal(true, { error: "can only be true; remove the flag" }).optional(),
        v2FinishResults: z.literal(true, { error: "can only be true; remove the flag" }).optional(),
        v2InoutReturns: z.literal(true, { error: "can only be true; remove the flag" }).optional(),
        v2ResourceImports: z.literal(true, { error: "can only be true; remove the flag" }).optional(),
        v2DefaultLibraries: z.literal(true, { error: "can only be true; remove the flag" }).optional(),
        v2TreeShaking: z.literal(true, { error: "can only be true; remove the flag" }).optional(),
    })
    .strict();

const deprecationsSchema = z.strictObject({
    /** Deprecation identifiers whose warnings are suppressed. There are currently no accepted identifiers. */
    silence: z
        .array(z.never({ error: "does not name a current deprecation" }), {
            error: "must be an array of current deprecation ids",
        })
        .optional(),
});

/** Schema every `gtkx.config.ts` is validated against, and the source of the {@link Config} type. */
const configSchema = z.strictObject({
    /**
     * Additional GIR libraries to bind, such as `WebKit-6.0`.
     * Adwaita and GTK are included implicitly and must not be listed.
     */
    libraries: librariesSchema.optional(),
    /** Additional GIR search directories. Relative paths are resolved from the project root. */
    girPath: z.array(z.string(), { error: "must be an array of strings if provided" }).optional(),
    /** Required GApplication identifier, such as `com.example.Tasks`. */
    applicationId: applicationIdSchema,
    /** Whether to enable the React Compiler, or options passed to it. Enabled by default. */
    reactCompiler: reactCompilerSchema.optional(),
    /**
     * Whether GTKX generates project bindings. Set to `false` to reuse an installed binding store.
     * Defaults to `true`.
     */
    codegen: z.boolean({ error: "must be a boolean" }).optional(),
    /**
     * Additional signals to suppress during React property updates, keyed by GLib type name.
     * Entries extend the built-in signal lists.
     */
    userEventSignals: userEventSignalsSchema.optional(),
    /** Custom element behaviors and overrides for generated components, props, and documentation. */
    elements: elementsSchema.optional(),
    /** Path to an icon theme directory or a single application icon file, relative to the project root. */
    applicationIcon: text("must be a path to an icon theme directory or a single icon file").optional(),
    /** Application metadata, bundled runtime settings, and packaging options used by `gtkx deploy`. */
    deploy: deploySchema.optional(),
    /** Controls the project instructions and reference files generated for coding agents. */
    agents: agentsSchema.optional(),
    /** Default tool selection and access mode for the project's MCP server. Command-line flags take precedence. */
    mcp: mcpSchema.optional(),
    /** Controls warnings for deprecated configuration and behavior. */
    deprecations: deprecationsSchema.optional(),
});

/**
 * Returns the given configuration unchanged, typed as {@link Config}, so `gtkx.config.ts` gets
 * autocompletion and type checking.
 */
const defineConfig: DefineConfig<Config> = createDefineConfig<Config>();
const validationSchema = configSchema.extend({ future: graduatedFutureSchema.optional() });

const isValidApplicationId = (applicationId: string): boolean =>
    applicationId.length <= APPLICATION_ID_MAX_LENGTH && APPLICATION_ID_PATTERN.test(applicationId);

const resolveReactCompilerOptions = (setting: Config["reactCompiler"]): ResolvedReactCompilerOptions | null => {
    if (setting === false) {
        return null;
    }

    const overrides = setting === undefined || setting === true ? {} : setting;

    return {
        ...(overrides.compilationMode !== undefined && { compilationMode: overrides.compilationMode }),
        ...(overrides.panicThreshold !== undefined && { panicThreshold: overrides.panicThreshold }),
        target: REACT_COMPILER_TARGET,
    };
};

const validateConfig = (config: unknown, configFile?: string): void => {
    const result = validationSchema.safeParse(config);

    if (!result.success) {
        throw configError(result.error, configFile);
    }
};

const graduatedFutureKeys = (config: unknown): string[] => {
    if (!isRecord(config) || !isRecord(config.future)) {
        return [];
    }

    return Object.keys(config.future).toSorted((first, second) => first.localeCompare(second));
};

/**
 * Deep-merges a configuration over a base. `override` wins over `base` on conflicting scalar and object keys, while
 * arrays are concatenated with the `override` entries first.
 */
const mergeConfig = (base: Config, override: Config): Config => defu(override, base);

const resolveElementsModule = (behaviors: string | undefined, root: string | undefined): string | null => {
    if (behaviors === undefined) {
        return null;
    }

    return root === undefined ? behaviors : resolve(root, behaviors);
};

const resolveLazyElements = (elements: Config["elements"]): string[] =>
    Object.entries(elements?.config ?? {})
        .filter(([, entry]) => entry.isLazy === true)
        .map(([type]) => type);

const elementEntryValues = <T>(
    elements: Config["elements"],
    pick: (entry: ElementConfigOptions) => T | undefined,
): Record<string, T> =>
    Object.fromEntries(
        Object.entries(elements?.config ?? {}).flatMap(([type, entry]) => {
            const value = pick(entry);

            return value === undefined ? [] : [[type, value] as const];
        }),
    );

const resolveElementComponents = (elements: Config["elements"]): Record<string, ModuleExport> =>
    elementEntryValues(elements, (entry) => entry.component);

const resolveElementProps = (elements: Config["elements"]): Record<string, ElementPropsExport> =>
    elementEntryValues(elements, (entry) => entry.props);

const resolveAcceptedChildTypes = (elements: Config["elements"]): Record<string, string[]> =>
    elementEntryValues(elements, (entry) => entry.acceptedChildTypes);

const resolveOmittedProps = (elements: Config["elements"]): Record<string, string[]> =>
    elementEntryValues(elements, (entry) => entry.omittedProps);

const isAgentRulesEnabled = (config: Config): boolean => config.agents?.rules !== false;
const isAgentReferenceEnabled = (config: Config): boolean => config.agents?.reference !== false;

const resolveMcpSettings = (config: Config): McpSettings => ({
    tools: config.mcp?.tools ?? [],
    isReadOnly: config.mcp?.readOnly === true,
});

const resolveConfig = (config: Config, root?: string): ResolvedConfig => ({
    applicationId: config.applicationId,
    reactCompiler: resolveReactCompilerOptions(config.reactCompiler),
    userEventSignals: resolveUserEventSignals(config.userEventSignals),
    elements: resolveElementsModule(config.elements?.behaviors, root),
    lazyElements: resolveLazyElements(config.elements),
});

export {
    APPLICATION_ID_MAX_LENGTH,
    defineConfig,
    isAgentReferenceEnabled,
    isAgentRulesEnabled,
    isValidApplicationId,
    graduatedFutureKeys,
    validateConfig,
    mergeConfig,
    resolveLazyElements,
    resolveElementComponents,
    resolveElementProps,
    resolveAcceptedChildTypes,
    resolveMcpSettings,
    resolveOmittedProps,
    resolveConfig,
    type McpSettings,
    type ResolvedReactCompilerOptions,
    type Config,
    type ElementConfigOptions,
    type ResolvedConfig,
};
