import { createDefineConfig, type DefineConfig } from "c12";
import { defu } from "defu";
import { z } from "zod";
import { configError, elementPropsSchema, isRecord, rawIssue } from "./element-props.js";

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

const configSchema = z.object({
    libraries: librariesSchema.optional(),
    girPath: z.array(z.string(), { error: "must be an array of strings if provided" }).optional(),
    applicationId: applicationIdSchema,
    elementProps: elementPropsSchema.optional(),
    reactCompiler: reactCompilerSchema.optional(),
    codegen: z.boolean({ error: "must be a boolean" }).optional(),
});

/**
 * User-facing configuration for a GTKX project, as authored in `gtkx.config.ts`:
 * the GIR libraries to bind, extra `.gir` search paths, the GApplication id,
 * custom element prop mappings, and the React Compiler and codegen settings.
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
 * identifier and the resolved React Compiler options (`null` when disabled).
 */
export type ResolvedConfig = {
    applicationId: string;
    reactCompiler: ResolvedReactCompilerOptions | null;
};

export const resolveConfig = (config: Config): ResolvedConfig => ({
    applicationId: config.applicationId,
    reactCompiler: resolveReactCompilerOptions(config.reactCompiler),
});
