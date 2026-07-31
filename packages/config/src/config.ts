import { createDefineConfig, type DefineConfig } from "c12";
import { defu } from "defu";
import { resolve } from "node:path";
import { z } from "zod";
import { configError, isRecord, rawIssue } from "./config-error.js";
import { resolveUserEventSignals } from "./user-event-signals.js";

type ReactCompilerCompilationMode = (typeof COMPILATION_MODES)[number];
type ReactCompilerPanicThreshold = (typeof PANIC_THRESHOLDS)[number];

type ReactCompilerOptions = {
    compilationMode?: ReactCompilerCompilationMode;
    panicThreshold?: ReactCompilerPanicThreshold;
};

/**
 * React Compiler options resolved for the build, with the compilation target
 * fixed to React 19.
 */
type ResolvedReactCompilerOptions = ReactCompilerOptions & {
    target: "19";
};

/**
 * User-facing configuration for a GTKX project, as authored in `gtkx.config.ts`:
 * the GIR libraries to bind, extra `.gir` search paths, the GApplication id,
 * a module of per-element configuration (lazy flags and custom behaviors),
 * per-element component wrappers and omitted props keyed by GLib type name, the
 * React Compiler and codegen settings, additional user event signals to suppress
 * during React commits, and extra GIR records to treat as class structs.
 */
type Config = z.infer<typeof configSchema>;
/** A `{ module, export }` reference to a named export, as element config entries carry it. */
type ModuleExport = z.infer<typeof moduleExportSchema>;
type ElementConfigEntry = z.infer<typeof elementConfigSchema>;

/**
 * Configuration reduced to the values needed at runtime: the GApplication
 * identifier, the resolved React Compiler options (`null` when disabled), the
 * user event signals suppressed while a React commit is in progress, and the
 * module path holding per-element configuration (`null` when unset).
 */
type ResolvedConfig = {
    applicationId: string;
    reactCompiler: ResolvedReactCompilerOptions | null;
    userEventSignals: Record<string, string[]>;
    elements: string | null;
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
    lazy: z.boolean({ error: "must be a boolean" }).optional(),
    omitProps: z
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

const configSchema = z.object({
    libraries: librariesSchema.optional(),
    girPath: z.array(z.string(), { error: "must be an array of strings if provided" }).optional(),
    applicationId: applicationIdSchema,
    reactCompiler: reactCompilerSchema.optional(),
    codegen: z.boolean({ error: "must be a boolean" }).optional(),
    userEventSignals: userEventSignalsSchema.optional(),
    elements: elementsSchema.optional(),
});

/**
 * Identity helper that returns the given configuration typed as {@link Config},
 * enabling editor autocompletion and type checking in `gtkx.config.ts`.
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
 * Deep-merges two configurations, with `override` taking precedence over `base`.
 * @param base The lower-priority configuration.
 * @param override The higher-priority configuration whose values win on conflict.
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
        .filter(([, entry]) => entry.lazy === true)
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

const resolveOmitProps = (elements: Config["elements"]): Record<string, string[]> =>
    elementEntryValues(elements, (entry) => entry.omitProps);

const resolveConfig = (config: Config, root?: string): ResolvedConfig => ({
    applicationId: config.applicationId,
    reactCompiler: resolveReactCompilerOptions(config.reactCompiler),
    userEventSignals: resolveUserEventSignals(config.userEventSignals),
    elements: resolveElementsModule(config.elements?.behaviors, root),
    lazyElements: resolveLazyElements(config.elements),
});

export {
    LIBRARIES_WILDCARD,
    GIR_LIBRARY_PATTERN,
    defineConfig,
    isValidApplicationId,
    resolveReactCompilerOptions,
    validateConfig,
    mergeConfig,
    resolveLazyElements,
    resolveElementComponents,
    resolveElementProps,
    resolveOmitProps,
    resolveConfig,
    type ResolvedReactCompilerOptions,
    type Config,
    type ModuleExport,
    type ResolvedConfig,
};
