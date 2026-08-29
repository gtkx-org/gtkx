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
 * User-facing configuration for a GTKX project, as authored in `gtkx.config.ts`: the GIR libraries
 * to bind and where to find them, the GApplication id, per-element configuration, the React
 * Compiler, codegen, and user event signal settings, and the `agents` and `mcp` blocks controlling
 * what coding agents are given.
 */
type Config = z.infer<typeof configSchema>;
type ModuleExport = z.infer<typeof moduleExportSchema>;
type ElementConfigEntry = z.infer<typeof elementConfigSchema>;

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
const DEFAULT_LIBRARIES: Set<string> = new Set(["Gtk-4.0", "Adw-1"]);
/** Compilation modes `babel-plugin-react-compiler` accepts. */
const COMPILATION_MODES = ["infer", "syntax", "annotation", "all"] as const;
/** Panic thresholds `babel-plugin-react-compiler` accepts. */
const PANIC_THRESHOLDS = ["none", "critical_errors", "all_errors"] as const;
const REACT_COMPILER_TARGET = "19";

const librarySchema = girLibrary('must be of the form "Name-Version", such as "Gtk-4.0"')
    .refine((library) => !DEFAULT_LIBRARIES.has(library), { error: "is bound by default; remove it" });

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
    z.object({
        compilationMode: z.enum(COMPILATION_MODES).optional(),
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

const moduleExportSchema = z.object(
    {
        module: z.string({ error: "must be a module specifier" }).min(1, { error: "must be a module specifier" }),
        export: z.string({ error: "must be an export name" }).min(1, { error: "must be an export name" }),
    },
    { error: "must be a { module, export } object" },
);

const elementConfigSchema = z.object({
    component: moduleExportSchema.optional(),
    props: moduleExportSchema.optional(),
    isLazy: z.boolean({ error: "must be a boolean" }).optional(),
    omittedProps: z
        .array(
            z.string({ error: "must be a non-empty property name" }).min(1, {
                error: "must be a non-empty property name",
            }),
            { error: "must be an array of property names" },
        )
        .optional(),
});

const elementsSchema = z.object({
    behaviors: z
        .string({ error: "must be a path to a module exporting element behaviors" })
        .min(1, { error: "must be a path to a module exporting element behaviors" })
        .optional(),
    config: z.record(z.string(), elementConfigSchema).optional(),
});

const agentsSchema = z.object({
    rules: z.boolean({ error: "must be a boolean" }).optional(),
    reference: z.boolean({ error: "must be a boolean" }).optional(),
});

const mcpSchema = z.object({
    tools: z
        .array(z.string({ error: "must be a tool name pattern" }).min(1, { error: "must be a tool name pattern" }), {
            error: "must be an array of tool name patterns",
        })
        .optional(),
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

const deprecationsSchema = z.object({
    silence: z
        .array(z.never({ error: "does not name a current deprecation" }), {
            error: "must be an array of current deprecation ids",
        })
        .optional(),
});

/** Schema every `gtkx.config.ts` is validated against, and the source of the {@link Config} type. */
const configSchema = z.object({
    libraries: librariesSchema.optional(),
    girPath: z.array(z.string(), { error: "must be an array of strings if provided" }).optional(),
    applicationId: applicationIdSchema,
    reactCompiler: reactCompilerSchema.optional(),
    codegen: z.boolean({ error: "must be a boolean" }).optional(),
    userEventSignals: userEventSignalsSchema.optional(),
    elements: elementsSchema.optional(),
    applicationIcon: text("must be a path to an icon theme directory or a single icon file").optional(),
    deploy: deploySchema.optional(),
    agents: agentsSchema.optional(),
    mcp: mcpSchema.optional(),
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

const validateConfig = (config: unknown): void => {
    const result = validationSchema.safeParse(config);

    if (!result.success) {
        throw configError(result.error);
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
    pick: (entry: ElementConfigEntry) => T | undefined,
): Record<string, T> =>
    Object.fromEntries(
        Object.entries(elements?.config ?? {}).flatMap(([type, entry]) => {
            const value = pick(entry);

            return value === undefined ? [] : [[type, value] as const];
        }),
    );

const resolveElementComponents = (elements: Config["elements"]): Record<string, ModuleExport> =>
    elementEntryValues(elements, (entry) => entry.component);

const resolveElementProps = (elements: Config["elements"]): Record<string, ModuleExport> =>
    elementEntryValues(elements, (entry) => entry.props);

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
    resolveMcpSettings,
    resolveOmittedProps,
    resolveConfig,
    type McpSettings,
    type ResolvedReactCompilerOptions,
    type Config,
    type ResolvedConfig,
};
