import {
    type ArrayPropRow,
    type ContainerPropRow,
    type ElementMapRule,
    type ObjectPropRow,
    type PerElementPropRows,
    type UserTableRows,
    type VirtualPropRow,
    validateArrayPropRows,
    validateContainerPropRows,
    validateElementMap,
    validateObjectPropRows,
    validateVirtualPropRows,
} from "./table-schema.js";

export const LIBRARIES_WILDCARD = "*";

export const GIR_NAMESPACE_PATTERN: RegExp = /^[A-Za-z][A-Za-z0-9]*-\d+(?:\.\d+)*$/;

export type GtkxConfig = UserTableRows & {
    libraries?: typeof LIBRARIES_WILDCARD | string[];

    girPath?: string[];

    applicationId?: string;

    reactCompiler?: boolean | ReactCompilerOptions;
};

export type ReactCompilerCompilationMode = "infer" | "syntax" | "annotation" | "all";

export type ReactCompilerPanicThreshold = "none" | "critical_errors" | "all_errors";

export type ReactCompilerOptions = {
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

/**
 * Validates a `gtkx.config.ts` object, throwing on the first invalid field.
 *
 * The loader invokes this exactly once per config load, after the file is read
 * and before resolution, so every config — whether wrapped in {@link defineConfig}
 * or exported as a plain object — is checked at the same point.
 *
 * @param config - the user config to validate
 * @throws Error when any field violates its schema
 */
export const validateGtkxConfig = (config: GtkxConfig): void => {
    validateLibraries(config.libraries);
    validateGirPath(config.girPath);
    validateApplicationId(config.applicationId);
    validateContainerPropRows(config.containerProps);
    validateArrayPropRows(config.arrayProps);
    validateObjectPropRows(config.objectProps);
    validateVirtualPropRows(config.virtualProps);
    validateElementMap(config.elementMap);
    validateReactCompiler(config.reactCompiler);
};

/**
 * Resolution context passed to a config-defining function so it can compute
 * fields per environment.
 */
export type GtkxConfigEnv = {
    /**
     * The mode the loader resolved the config in, e.g. `"development"` or
     * `"production"`. Populated by the loader when available.
     */
    mode?: string;
};

/**
 * A config-defining function that receives the {@link GtkxConfigEnv} and returns
 * a config synchronously.
 */
export type GtkxConfigFn = (env: GtkxConfigEnv) => GtkxConfig;

/**
 * A config-defining function that receives the {@link GtkxConfigEnv} and returns
 * a config asynchronously.
 */
export type GtkxConfigFnPromise = (env: GtkxConfigEnv) => Promise<GtkxConfig>;

/**
 * Every shape `gtkx.config.ts` may export as its default: a plain config, a
 * promise of one, or a function of {@link GtkxConfigEnv} returning either.
 */
export type GtkxConfigExport = GtkxConfig | Promise<GtkxConfig> | GtkxConfigFn | GtkxConfigFnPromise;

/**
 * Identity helper that gives `gtkx.config.ts` authors full type checking and
 * autocompletion over a plain config object. The loader validates the resolved
 * config once at load time via {@link validateGtkxConfig}.
 *
 * @param config - the user config, type-checked against {@link GtkxConfig}
 * @returns the same config object, unchanged
 */
export function defineConfig(config: GtkxConfig): GtkxConfig;
/**
 * Identity helper accepting a promise of a config, so authors can compute the
 * config asynchronously.
 *
 * @param config - a promise resolving to a {@link GtkxConfig}
 * @returns the same promise, unchanged
 */
export function defineConfig(config: Promise<GtkxConfig>): Promise<GtkxConfig>;
/**
 * Identity helper accepting a function of {@link GtkxConfigEnv} returning a
 * config, so authors can compute fields per environment (dev vs prod).
 *
 * @param config - a function returning a {@link GtkxConfig}
 * @returns the same function, unchanged
 */
export function defineConfig(config: GtkxConfigFn): GtkxConfigFn;
/**
 * Identity helper accepting a function of {@link GtkxConfigEnv} returning a
 * promise of a config, so authors can compute fields per environment
 * asynchronously.
 *
 * @param config - a function returning a promise of a {@link GtkxConfig}
 * @returns the same function, unchanged
 */
export function defineConfig(config: GtkxConfigFnPromise): GtkxConfigFnPromise;
/**
 * Identity helper accepting any supported config export shape.
 *
 * @param config - the config export, one of the {@link GtkxConfigExport} forms
 * @returns the same value, unchanged
 */
export function defineConfig(config: GtkxConfigExport): GtkxConfigExport;
export function defineConfig(config: GtkxConfigExport): GtkxConfigExport {
    return config;
}

const isMergeableObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const mergeConfigValue = (base: unknown, override: unknown): unknown => {
    if (override === undefined) return base;
    if (base === undefined) return override;
    if (Array.isArray(base) && Array.isArray(override)) return [...base, ...override];
    if (isMergeableObject(base) && isMergeableObject(override)) {
        const merged: Record<string, unknown> = { ...base };
        for (const key of Object.keys(override)) {
            merged[key] = mergeConfigValue(base[key], override[key]);
        }
        return merged;
    }
    return override;
};

/**
 * Deeply merges an override config onto a base config, mirroring Vite's
 * `mergeConfig`: arrays are concatenated, plain objects are merged recursively,
 * and any scalar value from `override` wins. Use it in a package's
 * `gtkx.config.ts` to extend a shared base config.
 *
 * @param base - the base config to extend.
 * @param override - the config whose values take precedence.
 * @returns a new merged config; the inputs are not mutated.
 */
export const mergeConfig = (base: GtkxConfig, override: GtkxConfig): GtkxConfig =>
    mergeConfigValue(base, override) as GtkxConfig;

/**
 * A fully resolved `gtkx.config.ts`, with every optional field defaulted to a
 * concrete value the toolchain consumes.
 *
 * `libraries` resolves to `[]` when omitted, distinct from the raw config's
 * `undefined`. This is the fingerprint/metadata view of the libraries setting
 * consumed by codegen's serialized config; the authoritative codegen default of
 * `["Gtk-4.0"]` is applied separately by `@gtkx/cli`'s library resolver, which
 * operates on the raw config and so still distinguishes `undefined` from `[]`.
 */
export type ResolvedGtkxConfig = {
    libraries: typeof LIBRARIES_WILDCARD | string[];
    girPath: string[];
    applicationId: string | undefined;
    containerProps: PerElementPropRows<ContainerPropRow>;
    arrayProps: PerElementPropRows<ArrayPropRow>;
    objectProps: PerElementPropRows<ObjectPropRow>;
    virtualProps: PerElementPropRows<VirtualPropRow>;
    elementMap: ElementMapRule[];
    reactCompiler: ResolvedReactCompilerOptions | null;
};

/**
 * Resolves a user `gtkx.config.ts` into a {@link ResolvedGtkxConfig}, defaulting
 * every omitted field.
 *
 * Each call returns fresh, independent copies of the mutable array and object
 * defaults so resolved configs never share aliased state, and `reactCompiler`
 * is computed via {@link resolveReactCompilerOptions}. See
 * {@link ResolvedGtkxConfig} for why `libraries` defaults to `[]`.
 *
 * @param config - the raw user config to resolve
 * @returns the resolved config with all defaults applied
 */
export const resolveGtkxConfig = (config: GtkxConfig): ResolvedGtkxConfig => ({
    libraries: config.libraries ?? [],
    girPath: config.girPath ?? [],
    applicationId: config.applicationId,
    containerProps: config.containerProps ?? {},
    arrayProps: config.arrayProps ?? {},
    objectProps: config.objectProps ?? {},
    virtualProps: config.virtualProps ?? {},
    elementMap: config.elementMap ?? [],
    reactCompiler: resolveReactCompilerOptions(config.reactCompiler),
});

const APPLICATION_ID_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)+$/;
const APPLICATION_ID_MAX_LENGTH = 255;

export const isValidApplicationId = (applicationId: string): boolean => {
    if (applicationId.length === 0 || applicationId.length > APPLICATION_ID_MAX_LENGTH) {
        return false;
    }
    return APPLICATION_ID_PATTERN.test(applicationId);
};
