import { createDefineConfig, type DefineConfig } from "c12";
import { defu } from "defu";
import { resolve } from "node:path";
import { z } from "zod";
import { configError, isRecord } from "./config-error.ts";
import { type DeployOptions, deploySchema } from "./deploy.ts";
import { girLibrary, text } from "./schema-text.ts";
import { resolveUserEventSignals } from "./user-event-signals.ts";

/** Object form of the `reactCompiler` config key, forwarded to `babel-plugin-react-compiler`. */
type ReactCompilerOptions = {
    /** Which functions the React Compiler processes. */
    compilationMode?: "all" | "annotation" | "infer" | "syntax" | undefined;
    /** Which React Compiler diagnostics fail the build. */
    panicThreshold?: "all_errors" | "critical_errors" | "none" | undefined;
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
type Config = {
    /**
     * Additional GIR libraries to bind, such as `WebKit-6.0`.
     * Adwaita and GTK are included implicitly and must not be listed.
     */
    libraries?: string[] | undefined;
    /** Additional GIR search directories. Relative paths are resolved from the project root. */
    girPath?: string[] | undefined;
    /**
     * GApplication identifier, such as `com.example.Tasks`. Required to run, build or deploy the project as an
     * application; a package that is not an application, such as a component library, leaves it out.
     */
    applicationId?: string | undefined;
    /** Whether to enable the React Compiler, or options passed to it. Enabled by default. */
    reactCompiler?: boolean | ReactCompilerOptions | undefined;
    /**
     * Whether GTKX generates project bindings. Set to `false` to reuse an installed binding store.
     * Defaults to `true`.
     */
    codegen?: boolean | undefined;
    /**
     * Additional signals to suppress during React property updates, keyed by GLib type name.
     * Entries extend the built-in signal lists.
     */
    userEventSignals?: Record<string, string[]> | undefined;
    /** Custom element behaviors and overrides for generated components, props, and documentation. */
    elements?: ElementsOptions | undefined;
    /** Path to an icon theme directory or a single application icon file, relative to the project root. */
    applicationIcon?: string | undefined;
    /** Application metadata, bundled runtime settings, and packaging options used by `gtkx deploy`. */
    deploy?: DeployOptions | undefined;
    /** Controls the project instructions and reference files generated for coding agents. */
    agents?: AgentsOptions | undefined;
    /** Default tool selection and access mode for the project's MCP server. Command-line flags take precedence. */
    mcp?: McpOptions | undefined;
    /** Controls warnings for deprecated configuration and behavior. */
    deprecations?: DeprecationsOptions | undefined;
};
/** A {@link Config} whose `applicationId` is known, as loaded for an application. */
type ApplicationConfig = Config & { applicationId: string };

/** A named export of a module, which `elements.config` entries reference for components and props. */
type ModuleExport = {
    /** Module specifier containing the named export; relative paths start at the project root. */
    module: string;
    /** Name of the export to import from the module. */
    export: string;
};

/** The props type an `elements.config` entry adds to a generated element, and how it combines with them. */
type ElementPropsExport = {
    /** Module specifier containing the named export; relative paths start at the project root. */
    module: string;
    /** Name of the props type to import from the module. */
    export: string;
    /**
     * How the exported props are combined: `intersection` is inherited; `factory` applies only to this type.
     * Defaults to `intersection`.
     */
    composition?: "factory" | "intersection" | undefined;
    /** Props that can only be set when the element is created; changing them afterward throws. */
    constructOnly?: string[] | undefined;
};

/** Overrides for one GLib type in `elements.config`, keyed by its registered type name. */
type ElementConfigOptions = {
    /** Component export that wraps the generated element. */
    component?: ModuleExport | undefined;
    /** Additional props type to combine with the generated element props. */
    props?: ElementPropsExport | undefined;
    /** Whether the parent container creates this element's GObject instead of the element constructing its own. */
    isLazy?: boolean | undefined;
    /** Accepted child GLib type names to show in the generated element documentation. */
    acceptedChildTypes?: string[] | undefined;
    /** GObject properties to leave out of generated props, such as properties managed by an element behavior. */
    omittedProps?: string[] | undefined;
};

/** The `elements` options: custom element behaviors and per-type overrides for generated elements. */
type ElementsOptions = {
    /** Path, relative to the project root, of the module exporting the element behavior map. */
    behaviors?: string | undefined;
    /** Element configuration overrides keyed by GLib type name, such as `GtkWidget`. */
    config?: Record<string, ElementConfigOptions> | undefined;
};

/** The `agents` options: which files codegen maintains for coding agents. */
type AgentsOptions = {
    /**
     * Whether codegen maintains the GTKX rules in `AGENTS.md` and creates a missing `CLAUDE.md` import.
     * `false` removes rules written earlier, deleting `AGENTS.md` and the `CLAUDE.md` import when nothing else
     * remains. Defaults to `true` for an application and `false` for a package without an `applicationId`.
     */
    rules?: boolean | undefined;
    /**
     * Whether codegen writes the generated element reference to `.gtkx/reference` and points the rules at it.
     * `false` removes a reference generated earlier. Defaults to `true` for an application and `false` for a
     * package without an `applicationId`.
     */
    reference?: boolean | undefined;
};

/** The `mcp` options: the tools `gtkx mcp` offers by default and whether it may interact with the app. */
type McpOptions = {
    /**
     * Tool name patterns applied in order: `*` matches any text and a leading `!` excludes matches.
     * Omitted, empty, or exclusion-only lists start with all tools; other lists start with none.
     */
    tools?: string[] | undefined;
    /**
     * Whether the MCP server exposes only inspection and reference tools, excluding app interactions.
     * Defaults to `false`.
     */
    readOnly?: boolean | undefined;
};

/** The `deprecations` options: which deprecation warnings stay silent. */
type DeprecationsOptions = {
    /** Deprecation identifiers whose warnings are suppressed. There are currently no accepted identifiers. */
    silence?: never[] | undefined;
};

type McpSettings = {
    tools: string[];
    isReadOnly: boolean;
};

/** Configuration reduced to the values the app runtime and the build need, with paths already resolved. */
type ResolvedConfig = {
    /** The GApplication identifier the app registers under. */
    applicationId: string;
    /** The gettext domain, which is the `applicationId` production builds use. */
    translationDomain: string;
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
const LIBRARY_APPLICATION_ID = "org.gtkx.Library";
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
    .string({
        error: (issue) =>
            issue.input === undefined
                ? 'is required to run, build or deploy an application, such as "org.example.MyApp"'
                : "must satisfy g_application_id_is_valid",
    })
    .refine((value) => isValidApplicationId(value), {
        error: 'must satisfy g_application_id_is_valid, such as "org.example.MyApp"',
    });

const reactCompilerOptionsSchema = z.strictObject({
    compilationMode: z.enum(COMPILATION_MODES).optional(),
    panicThreshold: z.enum(PANIC_THRESHOLDS).optional(),
}) satisfies z.ZodType<ReactCompilerOptions>;

const reactCompilerSchema = z.union([z.boolean(), reactCompilerOptionsSchema]);

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
        module: z.string({ error: "must be a module specifier" }).min(1, { error: "must be a module specifier" }),
        export: z.string({ error: "must be an export name" }).min(1, { error: "must be an export name" }),
    },
    { error: "must be a { module, export } object" },
) satisfies z.ZodType<ModuleExport>;

const elementPropsSchema = moduleExportSchema.extend({
    composition: z.enum(["factory", "intersection"]).optional(),
    constructOnly: z.array(z.string()).optional(),
}) satisfies z.ZodType<ElementPropsExport>;

const elementConfigSchema = z.strictObject({
    component: moduleExportSchema.optional(),
    props: elementPropsSchema.optional(),
    isLazy: z.boolean({ error: "must be a boolean" }).optional(),
    acceptedChildTypes: z.array(z.string()).optional(),
    omittedProps: z
        .array(
            z.string({ error: "must be a non-empty property name" }).min(1, {
                error: "must be a non-empty property name",
            }),
            { error: "must be an array of property names" },
        )
        .optional(),
}) satisfies z.ZodType<ElementConfigOptions>;

const elementsSchema = z.strictObject({
    behaviors: z
        .string({ error: "must be a path to a module exporting element behaviors" })
        .min(1, { error: "must be a path to a module exporting element behaviors" })
        .optional(),
    config: z.record(z.string(), elementConfigSchema).optional(),
}) satisfies z.ZodType<ElementsOptions>;

const agentsSchema = z.strictObject({
    rules: z.boolean({ error: "must be a boolean" }).optional(),
    reference: z.boolean({ error: "must be a boolean" }).optional(),
}) satisfies z.ZodType<AgentsOptions>;

const mcpSchema = z.strictObject({
    tools: z
        .array(z.string({ error: "must be a tool name pattern" }).min(1, { error: "must be a tool name pattern" }), {
            error: "must be an array of tool name patterns",
        })
        .optional(),
    readOnly: z.boolean({ error: "must be a boolean" }).optional(),
}) satisfies z.ZodType<McpOptions>;

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
    silence: z
        .array(z.never({ error: "does not name a current deprecation" }), {
            error: "must be an array of current deprecation ids",
        })
        .optional(),
}) satisfies z.ZodType<DeprecationsOptions>;

/** Schema every `gtkx.config.ts` is validated against. */
const configSchema = z.strictObject({
    libraries: librariesSchema.optional(),
    girPath: z.array(z.string(), { error: "must be an array of strings if provided" }).optional(),
    applicationId: applicationIdSchema.optional(),
    reactCompiler: reactCompilerSchema.optional(),
    codegen: z.boolean({ error: "must be a boolean" }).optional(),
    userEventSignals: userEventSignalsSchema.optional(),
    elements: elementsSchema.optional(),
    applicationIcon: text("must be a path to an icon theme directory or a single icon file").optional(),
    deploy: deploySchema.optional(),
    agents: agentsSchema.optional(),
    mcp: mcpSchema.optional(),
    deprecations: deprecationsSchema.optional(),
}) satisfies z.ZodType<Config>;

/**
 * Returns the given configuration unchanged, typed as {@link Config}, so `gtkx.config.ts` gets
 * autocompletion and type checking.
 */
const defineConfig: DefineConfig<Config> = createDefineConfig<Config>();
const validationSchema = configSchema.extend({
    applicationId: applicationIdSchema,
    future: graduatedFutureSchema.optional(),
});

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

const validateConfig: (config: unknown, configFile?: string) => asserts config is ApplicationConfig = (
    config,
    configFile,
) => {
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

const resolveModuleSpecifier = <T extends { module: string }>(reference: T, root: string): T =>
    reference.module.startsWith("./") || reference.module.startsWith("../")
        ? { ...reference, module: resolve(root, reference.module) }
        : reference;

const resolveElementComponents = (elements: Config["elements"], root: string): Record<string, ModuleExport> =>
    elementEntryValues(elements, (entry) => entry.component && resolveModuleSpecifier(entry.component, root));

const resolveElementProps = (elements: Config["elements"], root: string): Record<string, ElementPropsExport> =>
    elementEntryValues(elements, (entry) => entry.props && resolveModuleSpecifier(entry.props, root));

const resolveAcceptedChildTypes = (elements: Config["elements"]): Record<string, string[]> =>
    elementEntryValues(elements, (entry) => entry.acceptedChildTypes);

const resolveOmittedProps = (elements: Config["elements"]): Record<string, string[]> =>
    elementEntryValues(elements, (entry) => entry.omittedProps);

const isAgentRulesEnabled = (config: Config, isApplication: boolean): boolean => config.agents?.rules ?? isApplication;
const isAgentReferenceEnabled = (config: Config, isApplication: boolean): boolean =>
    config.agents?.reference ?? isApplication;

const resolveMcpSettings = (config: Config): McpSettings => ({
    tools: config.mcp?.tools ?? [],
    isReadOnly: config.mcp?.readOnly === true,
});

const resolveConfig = (config: ApplicationConfig, translationDomain: string, root?: string): ResolvedConfig => ({
    applicationId: config.applicationId,
    translationDomain,
    reactCompiler: resolveReactCompilerOptions(config.reactCompiler),
    userEventSignals: resolveUserEventSignals(config.userEventSignals),
    elements: resolveElementsModule(config.elements?.behaviors, root),
    lazyElements: resolveLazyElements(config.elements),
});

export {
    configSchema,
    APPLICATION_ID_MAX_LENGTH,
    LIBRARY_APPLICATION_ID,
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
    type AgentsOptions,
    type DeprecationsOptions,
    type ElementsOptions,
    type McpOptions,
    type McpSettings,
    type ReactCompilerOptions,
    type ResolvedReactCompilerOptions,
    type ApplicationConfig,
    type Config,
    type ElementConfigOptions,
    type ElementPropsExport,
    type ModuleExport,
    type ResolvedConfig,
};
