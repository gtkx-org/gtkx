import { createDefineConfig, type DefineConfig } from "c12";
import { defu } from "defu";

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

export type GtkxConfig = {
    libraries?: typeof LIBRARIES_WILDCARD | string[];
    girPath?: string[];
    applicationId?: string;
    rules?: string;
    reactCompiler?: boolean | ReactCompilerOptions;
    codegen?: boolean;
};

type ReactCompilerCompilationMode = "infer" | "syntax" | "annotation" | "all";

type ReactCompilerPanicThreshold = "none" | "critical_errors" | "all_errors";

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

const validateLibraryEntry = (library: unknown): void => {
    if (typeof library === "string" && GIR_LIBRARY_PATTERN.test(library)) {
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

const REACT_COMPILER_COMPILATION_MODES: ReactCompilerCompilationMode[] = ["infer", "syntax", "annotation", "all"];

const REACT_COMPILER_PANIC_THRESHOLDS: ReactCompilerPanicThreshold[] = ["none", "critical_errors", "all_errors"];

const validateReactCompilerEnum = <T extends string>(value: T | undefined, allowed: T[], field: string): void => {
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

const validateRules = (rules: GtkxConfig["rules"]): void => {
    if (rules !== undefined && (typeof rules !== "string" || rules.length === 0)) {
        throw new Error("gtkx.config.ts: `rules` must be a module specifier string default-exporting a `RuleRegistry`");
    }
};

const validateCodegen = (codegen: GtkxConfig["codegen"]): void => {
    if (codegen !== undefined && typeof codegen !== "boolean") {
        throw new Error("gtkx.config.ts: `codegen` must be a boolean if provided");
    }
};

export const validateGtkxConfig = (config: GtkxConfig): void => {
    validateLibraries(config.libraries);
    validateGirPath(config.girPath);
    validateApplicationId(config.applicationId);
    validateRules(config.rules);
    validateReactCompiler(config.reactCompiler);
    validateCodegen(config.codegen);
};

export const defineConfig: DefineConfig<GtkxConfig> = createDefineConfig<GtkxConfig>();

export const mergeConfig = (base: GtkxConfig, override: GtkxConfig): GtkxConfig => defu(override, base);

export type ResolvedGtkxConfig = {
    libraries: typeof LIBRARIES_WILDCARD | string[];
    girPath: string[];
    applicationId: string;
    rules: string | undefined;
    reactCompiler: ResolvedReactCompilerOptions | null;
    codegen: boolean;
};

export const resolveGtkxConfig = (config: GtkxConfig): ResolvedGtkxConfig => ({
    libraries: config.libraries ?? [],
    girPath: config.girPath ?? [],
    applicationId: config.applicationId ?? DEFAULT_APPLICATION_ID,
    rules: config.rules,
    reactCompiler: resolveReactCompilerOptions(config.reactCompiler),
    codegen: config.codegen ?? true,
});
