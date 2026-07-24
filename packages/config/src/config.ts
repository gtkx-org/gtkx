import { resolve } from "node:path";
import { createDefineConfig, type DefineConfig } from "c12";
import { defu } from "defu";
import { z } from "zod";
import { configError, isRecord, rawIssue } from "./config-error.js";
import { resolveUserEventSignals } from "./user-event-signals.js";

export const LIBRARIES_WILDCARD = "*";

export const GIR_LIBRARY_PATTERN: RegExp = /^[A-Za-z][A-Za-z0-9]*-\d+(?:\.\d+)*$/;

const APPLICATION_ID_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)+$/;
const APPLICATION_ID_MAX_LENGTH = 255;

export const isValidApplicationId = (applicationId: string): boolean => {
    if (applicationId.length === 0 || applicationId.length > APPLICATION_ID_MAX_LENGTH) {
        return false;
    }
    return APPLICATION_ID_PATTERN.test(applicationId);
};

const COMPILATION_MODES = ["infer", "syntax", "annotation", "all"] as const;

const PANIC_THRESHOLDS = ["none", "critical_errors", "all_errors"] as const;

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
export type ResolvedReactCompilerOptions = ReactCompilerOptions & {
    target: "19";
};

const REACT_COMPILER_TARGET = "19";

export const resolveReactCompilerOptions = (setting: Config["reactCompiler"]): ResolvedReactCompilerOptions | null => {
    if (setting === false) return null;
    const overrides = setting === undefined || setting === true ? {} : setting;
    return { ...overrides, target: REACT_COMPILER_TARGET };
};

const COMPILATION_MODE_SET: Set<string> = new Set(COMPILATION_MODES);

const PANIC_THRESHOLD_SET: Set<string> = new Set(PANIC_THRESHOLDS);

const librariesSchema = z.custom<typeof LIBRARIES_WILDCARD | string[]>().check((ctx) => {
    const value = ctx.value;
    if (value === LIBRARIES_WILDCARD) return;
    if (!Array.isArray(value) || value.length === 0) {
        ctx.issues.push(rawIssue(value, [], `must be "${LIBRARIES_WILDCARD}", a non-empty string array, or omitted`));
        return;
    }
    value.forEach((entry, index) => {
        if (typeof entry === "string" && GIR_LIBRARY_PATTERN.test(entry)) return;
        if (entry === LIBRARIES_WILDCARD) {
            ctx.issues.push(
                rawIssue(
                    value,
                    [index],
                    `to generate every library, set \`libraries: "${LIBRARIES_WILDCARD}"\` as a bare string, not an array entry`,
                    true,
                ),
            );
            return;
        }
        ctx.issues.push(
            rawIssue(
                value,
                [index],
                `invalid library identifier "${String(entry)}", must be of the form "Name-Version" (e.g. "Gtk-4.0")`,
                true,
            ),
        );
    });
});

const applicationIdSchema = z.custom<string>().check((ctx) => {
    const value = ctx.value;
    if (typeof value !== "string" || !isValidApplicationId(value)) {
        ctx.issues.push(
            rawIssue(
                value,
                [],
                `invalid \`applicationId\` "${String(value)}", must satisfy g_application_id_is_valid (e.g. "org.example.MyApp")`,
                true,
            ),
        );
    }
});

const reactCompilerSchema = z.custom<boolean | ReactCompilerOptions>().check((ctx) => {
    const value = ctx.value;
    if (typeof value === "boolean") return;
    if (!isRecord(value)) {
        ctx.issues.push(rawIssue(value, [], "must be a boolean or an options object"));
        return;
    }
    const compilationMode = value.compilationMode;
    if (
        compilationMode !== undefined &&
        !(typeof compilationMode === "string" && COMPILATION_MODE_SET.has(compilationMode))
    ) {
        ctx.issues.push(
            rawIssue(
                value,
                [],
                `invalid \`reactCompiler.compilationMode\` "${String(compilationMode)}", must be one of ${COMPILATION_MODES.join(", ")}`,
                true,
            ),
        );
    }
    const panicThreshold = value.panicThreshold;
    if (
        panicThreshold !== undefined &&
        !(typeof panicThreshold === "string" && PANIC_THRESHOLD_SET.has(panicThreshold))
    ) {
        ctx.issues.push(
            rawIssue(
                value,
                [],
                `invalid \`reactCompiler.panicThreshold\` "${String(panicThreshold)}", must be one of ${PANIC_THRESHOLDS.join(", ")}`,
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

const configSchema = z.object({
    libraries: librariesSchema.optional(),
    girPath: z.array(z.string(), { error: "must be an array of strings if provided" }).optional(),
    applicationId: applicationIdSchema,
    reactCompiler: reactCompilerSchema.optional(),
    codegen: z.boolean({ error: "must be a boolean" }).optional(),
    userEventSignals: userEventSignalsSchema.optional(),
    elementProps: z
        .string({ error: "must be a path to a module exporting element rules" })
        .min(1, { error: "must be a path to a module exporting element rules" })
        .optional(),
});

/**
 * User-facing configuration for a GTKX project, as authored in `gtkx.config.ts`:
 * the GIR libraries to bind, extra `.gir` search paths, the GApplication id,
 * a module of custom element rules, the React Compiler and codegen settings,
 * and additional user event signals to suppress during React commits.
 */
export type Config = z.infer<typeof configSchema>;

export const validateConfig = (config: Config): void => {
    const result = configSchema.safeParse(config);
    if (!result.success) throw configError(result.error);
};

/**
 * Identity helper that returns the given configuration typed as {@link Config},
 * enabling editor autocompletion and type checking in `gtkx.config.ts`.
 */
export const defineConfig: DefineConfig<Config> = createDefineConfig<Config>();

/**
 * Deep-merges two configurations, with `override` taking precedence over `base`.
 * @param base The lower-priority configuration.
 * @param override The higher-priority configuration whose values win on conflict.
 */
export const mergeConfig = (base: Config, override: Config): Config => defu(override, base);

/**
 * Configuration reduced to the values needed at runtime: the GApplication
 * identifier, the resolved React Compiler options (`null` when disabled), the
 * user event signals suppressed while a React commit is in progress, and the
 * module path holding custom element rules (`null` when unset).
 */
export type ResolvedConfig = {
    applicationId: string;
    reactCompiler: ResolvedReactCompilerOptions | null;
    userEventSignals: Record<string, string[]>;
    elementProps: string | null;
};

const resolveElementProps = (elementProps: string | undefined, root: string | undefined): string | null => {
    if (elementProps === undefined) return null;
    return root === undefined ? elementProps : resolve(root, elementProps);
};

export const resolveConfig = (config: Config, root?: string): ResolvedConfig => ({
    applicationId: config.applicationId,
    reactCompiler: resolveReactCompilerOptions(config.reactCompiler),
    userEventSignals: resolveUserEventSignals(config.userEventSignals),
    elementProps: resolveElementProps(config.elementProps, root),
});
