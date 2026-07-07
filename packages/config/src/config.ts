import { createDefineConfig, type DefineConfig } from "c12";
import { defu } from "defu";
import { z } from "zod";
import { configError, elementPropsSchema, isRecord, rawIssue } from "./element-props.js";

export const LIBRARIES_WILDCARD = "*";

export const GIR_LIBRARY_PATTERN: RegExp = /^[A-Za-z][A-Za-z0-9]*-\d+(?:\.\d+)*$/;

export const DEFAULT_APPLICATION_ID = "org.gtkx.app";

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

export type ResolvedReactCompilerOptions = ReactCompilerOptions & {
    target: "19";
};

const REACT_COMPILER_TARGET = "19";

export const resolveReactCompilerOptions = (
    setting: GtkxConfig["reactCompiler"],
): ResolvedReactCompilerOptions | null => {
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
                `invalid library identifier "${String(entry)}" — must be of the form "Name-Version" (e.g. "Gtk-4.0")`,
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
                `invalid \`applicationId\` "${String(value)}" — must satisfy g_application_id_is_valid (e.g. "org.example.MyApp")`,
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
                `invalid \`reactCompiler.compilationMode\` "${String(compilationMode)}" — must be one of ${COMPILATION_MODES.join(", ")}`,
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
                `invalid \`reactCompiler.panicThreshold\` "${String(panicThreshold)}" — must be one of ${PANIC_THRESHOLDS.join(", ")}`,
                true,
            ),
        );
    }
});

const gtkxConfigSchema = z.object({
    libraries: librariesSchema.optional(),
    girPath: z.array(z.string(), { error: "must be an array of strings if provided" }).optional(),
    applicationId: applicationIdSchema.optional(),
    elementProps: elementPropsSchema.optional(),
    reactCompiler: reactCompilerSchema.optional(),
    codegen: z.boolean({ error: "must be a boolean" }).optional(),
});

export type GtkxConfig = z.infer<typeof gtkxConfigSchema>;

export const validateGtkxConfig = (config: GtkxConfig): void => {
    const result = gtkxConfigSchema.safeParse(config);
    if (!result.success) throw configError(result.error);
};

export const defineConfig: DefineConfig<GtkxConfig> = createDefineConfig<GtkxConfig>();

export const mergeConfig = (base: GtkxConfig, override: GtkxConfig): GtkxConfig => defu(override, base);

export type ResolvedGtkxConfig = {
    applicationId: string;
    reactCompiler: ResolvedReactCompilerOptions | null;
};

export const resolveGtkxConfig = (config: GtkxConfig): ResolvedGtkxConfig => ({
    applicationId: config.applicationId ?? DEFAULT_APPLICATION_ID,
    reactCompiler: resolveReactCompilerOptions(config.reactCompiler),
});
