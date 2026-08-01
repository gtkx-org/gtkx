import { createDefineConfig, type DefineConfig } from "c12";
import { defu } from "defu";
import { resolve } from "node:path";
import { z } from "zod";
import { configError, isRecord, rawIssue } from "./config-error.ts";
import { resolveUserEventSignals } from "./user-event-signals.ts";

/** Accepted `reactCompiler.compilationMode` values, choosing which functions the compiler processes. */
type ReactCompilerCompilationMode = (typeof COMPILATION_MODES)[number];
/** Accepted `reactCompiler.panicThreshold` values, choosing which compiler diagnostics fail the build. */
type ReactCompilerPanicThreshold = (typeof PANIC_THRESHOLDS)[number];

/** Object form of the `reactCompiler` config key, forwarded as-is to `babel-plugin-react-compiler`. */
type ReactCompilerOptions = {
    /** Which functions the compiler processes; left to the compiler's own default when omitted. */
    compilationMode?: ReactCompilerCompilationMode;
    /** Which compiler diagnostics fail the build; left to the compiler's own default when omitted. */
    panicThreshold?: ReactCompilerPanicThreshold;
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
 * to bind and where to find them, the GApplication id, per-element configuration, and the React
 * Compiler, codegen, and user event signal settings.
 */
type Config = z.infer<typeof configSchema>;
/** A named export referenced as plain data, so codegen can emit an import for it without loading the module. */
type ModuleExport = z.infer<typeof moduleExportSchema>;
/** One `elements.config` entry, describing how a single GLib type's generated element is shaped. */
type ElementConfigEntry = z.infer<typeof elementConfigSchema>;

/** Configuration reduced to the values the app runtime and the build need, with paths already resolved. */
type ResolvedConfig = {
    /** The GApplication identifier the app registers under. */
    applicationId: string;
    /** React Compiler options for the build, or `null` when the compiler is disabled. */
    reactCompiler: ResolvedReactCompilerOptions | null;
    /** Signal names, keyed by GLib type name, that stay suppressed while a React commit runs. */
    userEventSignals: Record<string, string[]>;
    /** Path of the module exporting per-element configs, or `null` when none is configured. */
    elements: string | null;
    /** GLib type names of the elements marked `isLazy`, whose GObject their parent container creates. */
    lazyElements: string[];
};

const LIBRARIES_WILDCARD = "*";
const GIR_LIBRARY_PATTERN = /^[A-Za-z][A-Za-z0-9]*-\d+(?:\.\d+)*$/;
const APPLICATION_ID_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)+$/;
const APPLICATION_ID_MAX_LENGTH = 255;
const COMPILATION_MODES = ["infer", "syntax", "annotation", "all"] as const;
const PANIC_THRESHOLDS = ["none", "critical_errors", "all_errors"] as const;
const REACT_COMPILER_TARGET = "19";
const COMPILATION_MODE_SET: Set<string> = new Set(COMPILATION_MODES);
const PANIC_THRESHOLD_SET: Set<string> = new Set(PANIC_THRESHOLDS);

/** Validates `libraries`: the `"*"` wildcard on its own, or a non-empty array of `Name-Version` identifiers. */
const librariesSchema = z.custom<typeof LIBRARIES_WILDCARD | string[]>().check((ctx) => {
    const value = ctx.value;

    if (value === LIBRARIES_WILDCARD) {
        return;
    }

    if (!Array.isArray(value) || value.length === 0) {
        ctx.issues.push(rawIssue(value, [], `must be "${LIBRARIES_WILDCARD}", a non-empty string array, or omitted`));

        return;
    }

    for (const [index, entry] of value.entries()) {
        ctx.issues.push(...libraryEntryIssues(value, index, entry));
    }
});

/** Validates `applicationId` against the reverse-DNS form `g_application_id_is_valid` accepts. */
const applicationIdSchema = z.custom<string>().check((ctx) => {
    const value = ctx.value;

    if (typeof value !== "string" || !isValidApplicationId(value)) {
        ctx.issues.push(
            rawIssue(
                value,
                [],
                `invalid \`applicationId\` "${value}", must satisfy g_application_id_is_valid ` +
                '(e.g. "org.example.MyApp")',
                true,
            ),
        );
    }
});

/** Validates `reactCompiler`: a boolean, or an options object whose mode and threshold are known values. */
const reactCompilerSchema = z.custom<boolean | ReactCompilerOptions>().check((ctx) => {
    const value = ctx.value;

    if (typeof value === "boolean") {
        return;
    }

    if (!isRecord(value)) {
        ctx.issues.push(rawIssue(value, [], "must be a boolean or an options object"));

        return;
    }

    const compilationMode = value.compilationMode;

    if (!isValidReactCompilerOption(compilationMode, COMPILATION_MODE_SET)) {
        ctx.issues.push(
            rawIssue(
                value,
                [],
                `invalid \`reactCompiler.compilationMode\` "${String(compilationMode)}", ` +
                `must be one of ${COMPILATION_MODES.join(", ")}`,
                true,
            ),
        );
    }

    const panicThreshold = value.panicThreshold;

    if (!isValidReactCompilerOption(panicThreshold, PANIC_THRESHOLD_SET)) {
        ctx.issues.push(
            rawIssue(
                value,
                [],
                `invalid \`reactCompiler.panicThreshold\` "${String(panicThreshold)}", ` +
                `must be one of ${PANIC_THRESHOLDS.join(", ")}`,
                true,
            ),
        );
    }
});

/** Validates `userEventSignals`: GLib type names mapped to arrays of non-empty signal names. */
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

/** Validates a `{ module, export }` reference to a named export. */
const moduleExportSchema = z.object(
    {
        /** Specifier the export is imported from. */
        module: z.string({ error: "must be a module specifier" }).min(1, { error: "must be a module specifier" }),
        /** Identifier the module exports it under. */
        export: z.string({ error: "must be an export name" }).min(1, { error: "must be an export name" }),
    },
    { error: "must be a { module, export } object" },
);

/** Validates one entry of `elements.config`. */
const elementConfigSchema = z.object({
    /** Component that wraps the generated element. */
    component: moduleExportSchema.optional(),
    /** Base props interface the generated element props extend. */
    props: moduleExportSchema.optional(),
    /** Marks the element as having no GObject of its own, its parent container creating one instead. */
    isLazy: z.boolean({ error: "must be a boolean" }).optional(),
    /** GObject properties to leave out of the generated element props, such as those a behavior fills. */
    omittedProps: z
        .array(
            z.string({ error: "must be a non-empty property name" }).min(1, {
                error: "must be a non-empty property name",
            }),
            { error: "must be an array of property names" },
        )
        .optional(),
});

/** Validates `elements`: the behaviors module the app loads at runtime, plus the per-type entries. */
const elementsSchema = z.object({
    /**
     * Path, resolved against the project root, of a module default-exporting element configs keyed by
     * GLib type name, as `defineElements` returns.
     */
    behaviors: z
        .string({ error: "must be a path to a module exporting element behaviors" })
        .min(1, { error: "must be a path to a module exporting element behaviors" })
        .optional(),
    /** Per-element entries, keyed by GLib type name. */
    config: z.record(z.string(), elementConfigSchema).optional(),
});

/** The shape every `gtkx.config.ts` is validated against, and the source of the {@link Config} type. */
const configSchema = z.object({
    /**
     * GIR namespaces to bind as `Name-Version`, or `"*"` for every one installed; omitting it gives
     * `Gtk-4.0`, which is also prepended to any list that names no Gtk version of its own.
     */
    libraries: librariesSchema.optional(),
    /** Directories searched for `.gir` files ahead of `GTKX_GIR_PATH` and the system locations. */
    girPath: z.array(z.string(), { error: "must be an array of strings if provided" }).optional(),
    /** Reverse-DNS GApplication identifier, and the default `applicationId` of the application element. */
    applicationId: applicationIdSchema,
    /** React Compiler settings; the compiler runs unless this is `false`. */
    reactCompiler: reactCompilerSchema.optional(),
    /** Whether to generate the binding stores; `false` makes the CLI resolve an already-installed one. */
    codegen: z.boolean({ error: "must be a boolean" }).optional(),
    /**
     * Signal names, keyed by GLib type name, that stay suppressed while a React commit applies props, so
     * their handlers only ever report user interaction. Unioned with the built-in GTK4 and Adwaita table.
     */
    userEventSignals: userEventSignalsSchema.optional(),
    /** Per-element customization: where the behaviors module lives and how each type's element is shaped. */
    elements: elementsSchema.optional(),
});

/**
 * Returns the given configuration unchanged, typed as {@link Config}, so `gtkx.config.ts` gets
 * autocompletion and type checking.
 */
const defineConfig: DefineConfig<Config> = createDefineConfig<Config>();

const libraryEntryIssues = (value: unknown[], index: number, entry: unknown): ReturnType<typeof rawIssue>[] => {
    if (typeof entry === "string" && GIR_LIBRARY_PATTERN.test(entry)) {
        return [];
    }

    if (entry === LIBRARIES_WILDCARD) {
        const message =
            `to generate every library, set \`libraries: "${LIBRARIES_WILDCARD}"\` as a bare string, ` +
            "not an array entry";

        return [rawIssue(value, [index], message, true)];
    }

    const message =
        `invalid library identifier "${String(entry)}", must be of the form "Name-Version" ` +
        '(e.g. "Gtk-4.0")';

    return [rawIssue(value, [index], message, true)];
};

const isValidApplicationId = (applicationId: string): boolean => {
    if (applicationId.length === 0 || applicationId.length > APPLICATION_ID_MAX_LENGTH) {
        return false;
    }

    return APPLICATION_ID_PATTERN.test(applicationId);
};

const resolveReactCompilerOptions = (setting: Config["reactCompiler"]): ResolvedReactCompilerOptions | null => {
    if (setting === false) {
        return null;
    }

    const overrides = setting === undefined || setting === true ? {} : setting;

    return { ...overrides, target: REACT_COMPILER_TARGET };
};

const isValidReactCompilerOption = (value: unknown, allowed: Set<string>): boolean =>
    value === undefined || (typeof value === "string" && allowed.has(value));

const validateConfig = (config: Config): void => {
    const result = configSchema.safeParse(config);

    if (!result.success) {
        throw configError(result.error);
    }
};

/**
 * Deep-merges two configurations. `override` wins over `base` on conflicting scalar and object keys, while
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

const resolveConfig = (config: Config, root?: string): ResolvedConfig => ({
    applicationId: config.applicationId,
    reactCompiler: resolveReactCompilerOptions(config.reactCompiler),
    userEventSignals: resolveUserEventSignals(config.userEventSignals),
    elements: resolveElementsModule(config.elements?.behaviors, root),
    lazyElements: resolveLazyElements(config.elements),
});

export {
    defineConfig,
    isValidApplicationId,
    resolveReactCompilerOptions,
    validateConfig,
    mergeConfig,
    resolveLazyElements,
    resolveElementComponents,
    resolveElementProps,
    resolveOmittedProps,
    resolveConfig,
    type ResolvedReactCompilerOptions,
    type Config,
    type ModuleExport,
    type ResolvedConfig,
};
